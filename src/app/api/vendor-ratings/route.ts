// src/app/api/vendor-ratings/route.ts
// POST: Submit a rating for a completed service request
// GET:  Fetch all ratings for a vendor (vendor_id query param)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const RatingSubmitSchema = z.object({
  serviceRequestId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

function getSupabase(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
}

// ── POST: Submit a rating ─────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const supabase = getSupabase(token);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  const body = await request.json();
  const parsed = RatingSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { serviceRequestId, rating, comment } = parsed.data;

  // Fetch the service request — verify it's accepted/completed AND event is in the past
  const { data: req, error: reqErr } = await supabase
    .from("service_requests")
    .select(`
      id, event_id, service_id, vendor_id, requester_id, status,
      events (start_date, event_status)
    `)
    .eq("id", serviceRequestId)
    .single();

  if (reqErr || !req) {
    return NextResponse.json({ error: "Service request not found" }, { status: 404 });
  }

  // Only the organizer who made the request can rate
  if (req.requester_id !== user.id) {
    return NextResponse.json({ error: "Forbidden — you did not make this request" }, { status: 403 });
  }

  // Request must be accepted or completed
  if (!["accepted", "completed"].includes(req.status)) {
    return NextResponse.json({ error: "Can only rate accepted or completed service requests" }, { status: 400 });
  }

  // Event must have started (past or ongoing)
  const eventRow = Array.isArray(req.events) ? req.events[0] : req.events;
  if (eventRow) {
    const eventStart = new Date(eventRow.start_date);
    if (eventStart > new Date()) {
      return NextResponse.json({ error: "Cannot rate before the event has started" }, { status: 400 });
    }
  }

  // Insert rating — unique constraint handles duplicate prevention
  const { data: inserted, error: insertErr } = await supabase
    .from("vendor_ratings")
    .insert({
      service_request_id: serviceRequestId,
      event_id: req.event_id,
      vendor_id: req.vendor_id,
      service_id: req.service_id,
      rater_id: user.id,
      rating,
      comment: comment || null,
    })
    .select()
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "You have already rated this vendor for this event" }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, rating: inserted });
}

// ── GET: Fetch ratings received by a vendor ───────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const vendorId = searchParams.get("vendorId");
  const serviceId = searchParams.get("serviceId");

  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const supabase = getSupabase(token);

  let query = supabase
    .from("vendor_ratings")
    .select(`
      id, rating, comment, created_at,
      vendor_services:service_id (service_name, category),
      events:event_id (event_name),
      rater:rater_id (full_name)
    `)
    .order("created_at", { ascending: false });

  if (vendorId) query = query.eq("vendor_id", vendorId);
  if (serviceId) query = query.eq("service_id", serviceId);

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ratings: data ?? [] });
}
