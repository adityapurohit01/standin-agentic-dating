import { NextResponse } from "next/server";
import { seedRealPeople } from "@/server/reader/seed-real";

export async function POST(req: Request) {
  try {
    let replace = true;
    try {
      const body = await req.json();
      if (typeof body?.replace === "boolean") {
        replace = body.replace;
      }
    } catch {}

    const result = await seedRealPeople(replace);

    return NextResponse.json({
      success: true,
      count: result.count,
      names: result.names,
      message: `Successfully loaded ${result.count} verified public figures into the candidate pool (Satya Nadella, Sundar Pichai, Sam Altman, Reid Hoffman, etc.)`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
