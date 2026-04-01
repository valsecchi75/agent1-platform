import { NextRequest, NextResponse } from "next/server";
import { getReportData } from "@/lib/db";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import type { DateRange } from "@/lib/db-types";

// Helper to validate ISO date format (YYYY-MM-DD)
function isValidIsoDate(dateString: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(dateString)) {
    return false;
  }
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// Helper to calculate days between two dates
function daysBetween(from: string, to: string): number {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
}

// GET: Retrieve aggregated report data for a date range
// Query params: from (required, YYYY-MM-DD), to (required, YYYY-MM-DD)
// Validates: both required, date format, max 90-day range
export async function GET(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const { searchParams } = new URL(request.url);

    // Get from and to dates
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    // Validate both dates are provided
    if (!from || !to) {
      return NextResponse.json(
        {
          success: false,
          error: "Both 'from' and 'to' query parameters are required (format: YYYY-MM-DD)",
        },
        { status: 400 }
      );
    }

    // Validate date format
    if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
      return NextResponse.json(
        {
          success: false,
          error: "Date format must be YYYY-MM-DD",
        },
        { status: 400 }
      );
    }

    // Validate date range order
    if (from > to) {
      return NextResponse.json(
        {
          success: false,
          error: "'from' date must be before or equal to 'to' date",
        },
        { status: 400 }
      );
    }

    // Validate max range (90 days)
    const days = daysBetween(from, to);
    if (days > 90) {
      return NextResponse.json(
        {
          success: false,
          error: "Date range cannot exceed 90 days",
        },
        { status: 400 }
      );
    }

    // Build date range
    const dateRange: DateRange = { from, to };

    // Fetch report data
    const reportData = getReportData(dateRange);

    return NextResponse.json(reportData, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate report",
      },
      { status: 500 }
    );
  }
}
