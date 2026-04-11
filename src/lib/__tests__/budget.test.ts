// app/src/lib/__tests__/budget.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { closeDb } from "../db";

let testDbDir: string;

describe("budget enforcement", () => {
  beforeAll(() => {
    // Create a unique temp directory for this test run
    testDbDir = path.join(os.tmpdir(), `agent1-budget-test-${Date.now()}`);
    if (!fs.existsSync(testDbDir)) {
      fs.mkdirSync(testDbDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Set test DB path for all database operations
    process.env.__TEST_DB_PATH = path.join(
      testDbDir,
      `test-${Date.now()}-${Math.random()}.db`
    );
  });

  afterAll(() => {
    // Clean up test directory
    closeDb();
    try {
      if (fs.existsSync(testDbDir)) {
        const files = fs.readdirSync(testDbDir);
        files.forEach((file) => {
          const filePath = path.join(testDbDir, file);
          try {
            fs.unlinkSync(filePath);
          } catch {
            // Ignore
          }
          const walPath = `${filePath}-wal`;
          if (fs.existsSync(walPath)) {
            try {
              fs.unlinkSync(walPath);
            } catch {
              // Ignore
            }
          }
          const shmPath = `${filePath}-shm`;
          if (fs.existsSync(shmPath)) {
            try {
              fs.unlinkSync(shmPath);
            } catch {
              // Ignore
            }
          }
        });
        fs.rmdirSync(testDbDir);
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should allow generation when no department is assigned", () => {
    const { checkBudget } = require("../budget");

    const result = checkBudget({
      departmentId: null,
      role: "user",
      estimatedCost: 10,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetExceeded).toBeUndefined();
    expect(result.budgetWarning).toBeUndefined();
  });

  it("should allow generation when budget is not configured (0)", () => {
    const { createDepartment } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "No Budget Dept",
      budgetMonthly: 0,
    });

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 100,
    });

    expect(result.allowed).toBe(true);
  });

  it("should allow generation under threshold without warning", () => {
    const { createDepartment } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Budget Under Threshold",
      budgetMonthly: 1000,
      budgetWarningThreshold: 0.8,
    });

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 0.5,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toBeUndefined();
    expect(result.budgetStatus).toBeDefined();
    expect(result.budgetStatus!.usagePercent).toBe(0);
  });

  it("should return warning when usage is at warning threshold", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Budget At Threshold",
      budgetMonthly: 1000,
      budgetWarningThreshold: 0.8,
    });

    // Use exactly 800 (80% of 1000)
    updateBudgetUsed(deptId, 800);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 0.5,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toBeDefined();
    expect(result.budgetWarning).toContain("80%");
    expect(result.budgetStatus!.usagePercent).toBe(80);
  });

  it("should block generation when budget is exceeded for regular user", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Budget Exceeded",
      budgetMonthly: 1000,
      budgetSoftLimit: 0,
    });

    // Use 1000 (at limit)
    updateBudgetUsed(deptId, 1000);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 0.01, // Even 1 cent over
    });

    expect(result.allowed).toBe(false);
    expect(result.budgetExceeded).toBe(true);
  });

  it("should allow overage within soft limit for regular user", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Budget With Soft Limit",
      budgetMonthly: 100,
      budgetSoftLimit: 10,
    });

    // Use 95 (of 100 limit)
    updateBudgetUsed(deptId, 95);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 15, // 95 + 15 = 110, within 100 + 10 soft limit
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetExceeded).toBeUndefined();
  });

  it("should allow exactly at soft limit boundary", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Soft Limit Boundary",
      budgetMonthly: 100,
      budgetSoftLimit: 10,
    });

    updateBudgetUsed(deptId, 95);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 15, // Exactly at boundary: 95 + 15 = 110 = 100 + 10
    });

    expect(result.allowed).toBe(true);
  });

  it("should block one cent over soft limit boundary", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Over Soft Limit",
      budgetMonthly: 100,
      budgetSoftLimit: 10,
    });

    updateBudgetUsed(deptId, 95);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 15.01, // 95 + 15.01 = 110.01 > 110
    });

    expect(result.allowed).toBe(false);
    expect(result.budgetExceeded).toBe(true);
  });

  it("should allow admin user to generate even when budget exceeded", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Budget For Admin",
      budgetMonthly: 100,
      budgetSoftLimit: 0,
    });

    updateBudgetUsed(deptId, 100);

    const result = checkBudget({
      departmentId: deptId,
      role: "admin",
      estimatedCost: 50,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetExceeded).toBeUndefined();
  });

  it("should allow dept_admin user to generate even when budget exceeded", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Budget For Dept Admin",
      budgetMonthly: 50,
      budgetSoftLimit: 0,
    });

    updateBudgetUsed(deptId, 50);

    const result = checkBudget({
      departmentId: deptId,
      role: "dept_admin",
      estimatedCost: 25,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetExceeded).toBeUndefined();
  });

  it("should show warning to admin even when allowed", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Admin Warning",
      budgetMonthly: 100,
      budgetWarningThreshold: 0.8,
    });

    updateBudgetUsed(deptId, 80);

    const result = checkBudget({
      departmentId: deptId,
      role: "admin",
      estimatedCost: 10,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toBeDefined();
    expect(result.budgetWarning).toContain("80%");
  });

  it("should show warning to dept_admin even when allowed", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Dept Admin Warning",
      budgetMonthly: 200,
      budgetWarningThreshold: 0.8,
    });

    updateBudgetUsed(deptId, 160);

    const result = checkBudget({
      departmentId: deptId,
      role: "dept_admin",
      estimatedCost: 10,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toBeDefined();
    expect(result.budgetWarning).toContain("80%");
  });

  it("should not show warning if below threshold for admin", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Admin No Warning",
      budgetMonthly: 100,
      budgetWarningThreshold: 0.8,
    });

    updateBudgetUsed(deptId, 50);

    const result = checkBudget({
      departmentId: deptId,
      role: "admin",
      estimatedCost: 10,
    });

    expect(result.allowed).toBe(true);
    expect(result.budgetWarning).toBeUndefined();
  });

  it("should include budget status in response", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Status Test",
      budgetMonthly: 500,
    });

    updateBudgetUsed(deptId, 150);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 10,
    });

    expect(result.budgetStatus).toBeDefined();
    expect(result.budgetStatus!.departmentName).toBe("Status Test");
    expect(result.budgetStatus!.budgetMonthly).toBe(500);
    expect(result.budgetStatus!.budgetUsed).toBe(150);
    expect(result.budgetStatus!.usagePercent).toBe(30);
  });

  it("should use default estimated cost when not provided", () => {
    const { getEstimatedCost } = require("../budget");

    expect(getEstimatedCost(undefined)).toBe(0.25);
    expect(getEstimatedCost(null)).toBe(0.25);
    expect(getEstimatedCost(0)).toBe(0.25);
    expect(getEstimatedCost(0.5)).toBe(0.5);
    expect(getEstimatedCost(100)).toBe(100);
  });

  it("should round usage percentage correctly", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Percentage Rounding",
      budgetMonthly: 3,
    });

    updateBudgetUsed(deptId, 1); // 1/3 = 0.333... = 33%

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 0.1,
    });

    expect(result.budgetStatus!.usagePercent).toBe(33);
  });

  it("should handle high precision float costs", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "High Precision",
      budgetMonthly: 1000,
      budgetSoftLimit: 50,
    });

    updateBudgetUsed(deptId, 999.99);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 50.01, // 999.99 + 50.01 = 1050, exactly at boundary
    });

    expect(result.allowed).toBe(true);
  });

  it("should block if cost would exceed by fraction of cent", () => {
    const { createDepartment, updateBudgetUsed } = require("../departments");
    const { checkBudget } = require("../budget");

    const deptId = createDepartment({
      name: "Fraction Test",
      budgetMonthly: 100,
      budgetSoftLimit: 5,
    });

    updateBudgetUsed(deptId, 100);

    const result = checkBudget({
      departmentId: deptId,
      role: "user",
      estimatedCost: 5.001, // Would exceed by 0.001
    });

    expect(result.allowed).toBe(false);
    expect(result.budgetExceeded).toBe(true);
  });
});
