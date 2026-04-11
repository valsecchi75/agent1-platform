// app/src/lib/__tests__/departments.test.ts
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { getDb, createUser, closeDb } from "../db";

// Use temp directory for test databases
let testDbDir: string;

describe("departments table migration", () => {
  beforeAll(() => {
    // Create a unique temp directory for this test run
    testDbDir = path.join(os.tmpdir(), `agent1-dept-test-${Date.now()}`);
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

  it("should create departments table with correct columns", () => {
    const db = getDb();
    const tableInfo = db
      .prepare("PRAGMA table_info(departments)")
      .all() as Array<{ name: string; type: string }>;
    const columnNames = tableInfo.map((c) => c.name);

    expect(columnNames).toContain("id");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("description");
    expect(columnNames).toContain("budget_monthly");
    expect(columnNames).toContain("budget_used");
    expect(columnNames).toContain("budget_period_start");
    expect(columnNames).toContain("budget_warning_threshold");
    expect(columnNames).toContain("budget_soft_limit");
    expect(columnNames).toContain("created_at");
    expect(columnNames).toContain("updated_at");
  });

  it("should add department_id column to users table", () => {
    const db = getDb();
    const tableInfo = db
      .prepare("PRAGMA table_info(users)")
      .all() as Array<{ name: string }>;
    const columnNames = tableInfo.map((c) => c.name);

    expect(columnNames).toContain("department_id");
  });

  it("should allow dept_admin role in users table", async () => {
    const userId = await createUser({
      username: "dept_test",
      password: "password123",
      role: "dept_admin",
    });

    expect(userId).toBeTruthy();

    const db = getDb();
    const user = db
      .prepare("SELECT role FROM users WHERE id = ?")
      .get(userId) as { role: string };

    expect(user.role).toBe("dept_admin");
  });
});

describe("department CRUD operations", () => {
  beforeAll(() => {
    // Create a unique temp directory for this test run
    testDbDir = path.join(os.tmpdir(), `agent1-dept-crud-${Date.now()}`);
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
    vi.resetModules(); // Reset module cache to get fresh db instance
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

  it("should create a department and return a valid ID", async () => {
    const { createDepartment } = await import("../departments");

    const deptId = createDepartment({
      name: "Engineering",
      description: "Engineering department",
      budgetMonthly: 5000,
    });

    expect(deptId).toBeTruthy();
    expect(typeof deptId).toBe("string");
    expect(deptId.length).toBeGreaterThan(0);
  });

  it("should create a department with default values", () => {
    const { createDepartment, getDepartmentById } = require("../departments");

    const deptId = createDepartment({
      name: "Sales",
    });

    const dept = getDepartmentById(deptId);
    expect(dept).toBeTruthy();
    expect(dept.name).toBe("Sales");
    expect(dept.description).toBeNull();
    expect(dept.budget_monthly).toBe(0);
    expect(dept.budget_warning_threshold).toBe(0.8);
    expect(dept.budget_soft_limit).toBe(0);
    expect(dept.budget_used).toBe(0);
  });

  it("should not allow duplicate department names", () => {
    const { createDepartment } = require("../departments");

    createDepartment({ name: "HR" });

    expect(() => {
      createDepartment({ name: "HR" });
    }).toThrow();
  });

  it("should retrieve a department by ID", () => {
    const { createDepartment, getDepartmentById } = require("../departments");

    const deptId = createDepartment({
      name: "Product",
      description: "Product team",
      budgetMonthly: 3000,
    });

    const dept = getDepartmentById(deptId);
    expect(dept).toBeTruthy();
    expect(dept!.id).toBe(deptId);
    expect(dept!.name).toBe("Product");
    expect(dept!.description).toBe("Product team");
    expect(dept!.budget_monthly).toBe(3000);
  });

  it("should return null for non-existent department", () => {
    const { getDepartmentById } = require("../departments");

    const dept = getDepartmentById("nonexistent-id");
    expect(dept).toBeNull();
  });

  it("should list all departments in alphabetical order", () => {
    const { createDepartment, listDepartments } = require("../departments");

    createDepartment({ name: "Zebra Team" });
    createDepartment({ name: "Alpha Team" });
    createDepartment({ name: "Beta Team" });

    const depts = listDepartments();
    expect(depts.length).toBe(3);
    expect(depts[0].name).toBe("Alpha Team");
    expect(depts[1].name).toBe("Beta Team");
    expect(depts[2].name).toBe("Zebra Team");
  });

  it("should update department fields", () => {
    const { createDepartment, getDepartmentById, updateDepartment } = require("../departments");

    const deptId = createDepartment({
      name: "Marketing",
      budgetMonthly: 2000,
    });

    updateDepartment(deptId, {
      description: "Updated description",
      budgetMonthly: 3000,
      budgetWarningThreshold: 0.7,
    });

    const updated = getDepartmentById(deptId);
    expect(updated!.description).toBe("Updated description");
    expect(updated!.budget_monthly).toBe(3000);
    expect(updated!.budget_warning_threshold).toBe(0.7);
  });

  it("should update partial fields without affecting others", () => {
    const { createDepartment, getDepartmentById, updateDepartment } = require("../departments");

    const deptId = createDepartment({
      name: "Support",
      description: "Original description",
      budgetMonthly: 1500,
      budgetSoftLimit: 200,
    });

    updateDepartment(deptId, {
      budgetMonthly: 2000,
    });

    const updated = getDepartmentById(deptId);
    expect(updated!.description).toBe("Original description");
    expect(updated!.budget_monthly).toBe(2000);
    expect(updated!.budget_soft_limit).toBe(200);
  });

  it("should update timestamp when modifying a department", () => {
    const { createDepartment, getDepartmentById, updateDepartment } = require("../departments");

    const deptId = createDepartment({
      name: "Operations",
    });

    const original = getDepartmentById(deptId);
    const originalUpdated = original!.updated_at;

    // Small delay to ensure timestamp changes
    const before = new Date();
    updateDepartment(deptId, {
      description: "New description",
    });
    const after = new Date();

    const updated = getDepartmentById(deptId);
    const updatedTime = new Date(updated!.updated_at);

    expect(updatedTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(updatedTime.getTime()).toBeLessThanOrEqual(after.getTime() + 1000); // +1s for precision
  });

  it("should delete an empty department", () => {
    const { createDepartment, getDepartmentById, deleteDepartment } = require("../departments");

    const deptId = createDepartment({
      name: "Temp Department",
    });

    expect(getDepartmentById(deptId)).toBeTruthy();

    deleteDepartment(deptId);

    expect(getDepartmentById(deptId)).toBeNull();
  });

  it("should reject deleting a department with members", async () => {
    const { createDepartment, deleteDepartment } = require("../departments");

    const deptId = createDepartment({
      name: "Locked Department",
    });

    await createUser({
      username: "member1",
      password: "password123",
      role: "user",
      departmentId: deptId,
    });

    expect(() => {
      deleteDepartment(deptId);
    }).toThrow(/Cannot delete department with active members/);
  });

  it("should list department members with stats", async () => {
    const { createDepartment, getDepartmentMembers } = require("../departments");

    const deptId = createDepartment({
      name: "Analytics Team",
    });

    const userId1 = await createUser({
      username: "analyst1",
      password: "password123",
      role: "user",
      displayName: "Alice",
      departmentId: deptId,
    });

    const userId2 = await createUser({
      username: "analyst2",
      password: "password123",
      role: "user",
      displayName: "Bob",
      departmentId: deptId,
    });

    const members = getDepartmentMembers(deptId);

    expect(members.length).toBe(2);
    expect(members[0].username).toBe("analyst1");
    expect(members[0].displayName).toBe("Alice");
    expect(members[0].role).toBe("user");
    expect(members[0].totalCost).toBe(0);
    expect(members[0].generationCount).toBe(0);
    expect(members[1].username).toBe("analyst2");
  });

  it("should list department members in username order", async () => {
    const { createDepartment, getDepartmentMembers } = require("../departments");

    const deptId = createDepartment({
      name: "Team Beta",
    });

    await createUser({
      username: "zebra",
      password: "password123",
      role: "user",
      departmentId: deptId,
    });

    await createUser({
      username: "alpha",
      password: "password123",
      role: "user",
      departmentId: deptId,
    });

    await createUser({
      username: "bravo",
      password: "password123",
      role: "user",
      departmentId: deptId,
    });

    const members = getDepartmentMembers(deptId);

    expect(members.length).toBe(3);
    expect(members[0].username).toBe("alpha");
    expect(members[1].username).toBe("bravo");
    expect(members[2].username).toBe("zebra");
  });

  it("should count department members", async () => {
    const { createDepartment, getDepartmentMemberCount } = require("../departments");

    const deptId = createDepartment({
      name: "Team Gamma",
    });

    expect(getDepartmentMemberCount(deptId)).toBe(0);

    await createUser({
      username: "user1",
      password: "password123",
      role: "user",
      departmentId: deptId,
    });

    expect(getDepartmentMemberCount(deptId)).toBe(1);

    await createUser({
      username: "user2",
      password: "password123",
      role: "user",
      departmentId: deptId,
    });

    expect(getDepartmentMemberCount(deptId)).toBe(2);
  });

  it("should initialize budget period start on department creation", () => {
    const { createDepartment, getDepartmentById, getFirstOfMonthUTC } = require("../departments");

    const deptId = createDepartment({
      name: "Budget Test Dept",
    });

    const dept = getDepartmentById(deptId);
    const expectedFirstOfMonth = getFirstOfMonthUTC();

    expect(dept!.budget_period_start).toBe(expectedFirstOfMonth);
  });

  it("should reset budget when period changes", () => {
    const { createDepartment, getDepartmentById, updateBudgetUsed, ensureBudgetPeriodCurrent } = require("../departments");

    const deptId = createDepartment({
      name: "Budget Reset Test",
      budgetMonthly: 1000,
    });

    // Add some usage
    updateBudgetUsed(deptId, 500);
    let dept = getDepartmentById(deptId);
    expect(dept!.budget_used).toBe(500);

    // Manually set period to last month to trigger reset
    const db = getDb();
    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
    const lastMonthFirst = new Date(Date.UTC(lastMonth.getUTCFullYear(), lastMonth.getUTCMonth(), 1)).toISOString();
    db.prepare("UPDATE departments SET budget_period_start = ? WHERE id = ?").run(lastMonthFirst, deptId);

    // Trigger period check
    ensureBudgetPeriodCurrent(deptId);

    dept = getDepartmentById(deptId);
    expect(dept!.budget_used).toBe(0);
  });

  it("should not reset budget if period is still current", () => {
    const { createDepartment, getDepartmentById, updateBudgetUsed, ensureBudgetPeriodCurrent } = require("../departments");

    const deptId = createDepartment({
      name: "Budget No Reset Test",
      budgetMonthly: 1000,
    });

    updateBudgetUsed(deptId, 300);
    let dept = getDepartmentById(deptId);
    expect(dept!.budget_used).toBe(300);

    // Ensure period is still current
    const result = ensureBudgetPeriodCurrent(deptId);
    expect(result).toBe(false); // Should return false (no reset needed)

    dept = getDepartmentById(deptId);
    expect(dept!.budget_used).toBe(300); // Should remain unchanged
  });
});
