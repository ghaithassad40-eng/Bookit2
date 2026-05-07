-- ============================================================
-- Bookit — Demo seed data (idempotent)
-- ============================================================
-- Run this AFTER an admin user exists. To attach demo businesses
-- to a real owner, replace the literal in v_owner with that user's id
-- (or set DEFAULT_OWNER_ID env var and update the line below).
-- ============================================================

do $seed$
declare
  v_owner uuid := null;  -- public/demo data, no owner
  v_gym       uuid;
  v_salon     uuid;
  v_clinic    uuid;
  v_yoga      uuid;
  v_svc       uuid;
  v_staff     uuid;
  v_day       date;
  v_hour      int;
  v_start     timestamptz;
begin

  -- ---------- businesses ----------
  insert into public.businesses (name, slug, industry, logo_url, owner_id)
  values ('Pulse Athletic Club', 'pulse-athletic', 'gym', null, v_owner)
  on conflict (slug) do update set name = excluded.name
  returning id into v_gym;

  insert into public.businesses (name, slug, industry, logo_url, owner_id)
  values ('Lumen Hair Studio', 'lumen-hair', 'salon', null, v_owner)
  on conflict (slug) do update set name = excluded.name
  returning id into v_salon;

  insert into public.businesses (name, slug, industry, logo_url, owner_id)
  values ('Northgate Family Clinic', 'northgate-clinic', 'clinic', null, v_owner)
  on conflict (slug) do update set name = excluded.name
  returning id into v_clinic;

  insert into public.businesses (name, slug, industry, logo_url, owner_id)
  values ('Stillpoint Yoga', 'stillpoint-yoga', 'yoga', null, v_owner)
  on conflict (slug) do update set name = excluded.name
  returning id into v_yoga;

  -- ---------- configs ----------
  insert into public.business_configs (business_id, theme_json, copy_json, booking_rules_json, layout_json) values
  (v_gym,
   '{"mode":"dark","primaryColor":"#0B0B0F","accentColor":"#22D3EE","secondaryColor":"#A3E635","fontFamily":"Inter","borderRadius":"2xl","cardStyle":"glass","animationStyle":"smooth"}'::jsonb,
   '{"heroTitle":"Train smarter. Move further.","heroSubtitle":"Book a session with our certified coaches in seconds.","ctaText":"Book a Session","confirmationMessage":"Your session is locked in. See you on the floor."}'::jsonb,
   '{"allowStaffSelection":true,"requirePhone":true,"requireEmail":true,"allowNotes":true,"preventDoubleBooking":true,"slotDurationMinutes":60,"maxAdvanceBookingDays":30,"cancellationWindowHours":12}'::jsonb,
   '{"showTestimonials":true,"showStaff":true,"showServicesPreview":true}'::jsonb),

  (v_salon,
   '{"mode":"light","primaryColor":"#FAF7F2","accentColor":"#C2410C","secondaryColor":"#1F2937","fontFamily":"Plus Jakarta Sans","borderRadius":"2xl","cardStyle":"soft","animationStyle":"smooth"}'::jsonb,
   '{"heroTitle":"Beauty, on your schedule.","heroSubtitle":"Premium cuts, color, and care from our master stylists.","ctaText":"Book Appointment","confirmationMessage":"You''re booked. Can''t wait to see you."}'::jsonb,
   '{"allowStaffSelection":true,"requirePhone":true,"requireEmail":true,"allowNotes":true,"preventDoubleBooking":true,"slotDurationMinutes":45,"maxAdvanceBookingDays":45,"cancellationWindowHours":24}'::jsonb,
   '{"showTestimonials":true,"showStaff":true,"showServicesPreview":true}'::jsonb),

  (v_clinic,
   '{"mode":"light","primaryColor":"#F8FAFC","accentColor":"#0EA5E9","secondaryColor":"#0F172A","fontFamily":"Inter","borderRadius":"xl","cardStyle":"flat","animationStyle":"subtle"}'::jsonb,
   '{"heroTitle":"Care without the wait.","heroSubtitle":"Same-week appointments with trusted clinicians.","ctaText":"Book a Visit","confirmationMessage":"Your visit is scheduled."}'::jsonb,
   '{"allowStaffSelection":true,"requirePhone":true,"requireEmail":true,"allowNotes":true,"preventDoubleBooking":true,"slotDurationMinutes":30,"maxAdvanceBookingDays":60,"cancellationWindowHours":24}'::jsonb,
   '{"showTestimonials":false,"showStaff":true,"showServicesPreview":true}'::jsonb),

  (v_yoga,
   '{"mode":"light","primaryColor":"#FFFBEB","accentColor":"#7C3AED","secondaryColor":"#0F172A","fontFamily":"Plus Jakarta Sans","borderRadius":"2xl","cardStyle":"glass","animationStyle":"smooth"}'::jsonb,
   '{"heroTitle":"Find your stillness.","heroSubtitle":"Drop into a class led by experienced teachers.","ctaText":"Reserve Mat","confirmationMessage":"Your spot is reserved. Breathe."}'::jsonb,
   '{"allowStaffSelection":false,"requirePhone":false,"requireEmail":true,"allowNotes":false,"preventDoubleBooking":true,"slotDurationMinutes":75,"maxAdvanceBookingDays":21,"cancellationWindowHours":4}'::jsonb,
   '{"showTestimonials":true,"showStaff":true,"showServicesPreview":true}'::jsonb)
  on conflict (business_id) do update set
    theme_json = excluded.theme_json,
    copy_json = excluded.copy_json,
    booking_rules_json = excluded.booking_rules_json,
    layout_json = excluded.layout_json;

  -- ---------- services ----------
  insert into public.services (business_id, name, description, duration_minutes, price, currency, capacity, color)
  values
    (v_gym, 'Personal Training', '1:1 coached strength session.', 60, 80, 'USD', 1, '#22D3EE'),
    (v_gym, 'Open Gym', 'Floor access with on-call coach.', 60, 20, 'USD', 12, '#A3E635'),
    (v_gym, 'HIIT Class', 'Group conditioning circuit.', 45, 25, 'USD', 14, '#F472B6'),
    (v_salon, 'Signature Cut', 'Consultation, cut and finish.', 45, 65, 'USD', 1, '#C2410C'),
    (v_salon, 'Color & Highlights', 'Custom color with toner.', 120, 180, 'USD', 1, '#A21CAF'),
    (v_salon, 'Express Blowout', 'Wash and style.', 30, 40, 'USD', 1, '#0EA5E9'),
    (v_clinic, 'General Consult', 'Standard 30-min visit.', 30, 90, 'USD', 1, '#0EA5E9'),
    (v_clinic, 'Annual Physical', 'Comprehensive wellness check.', 60, 180, 'USD', 1, '#10B981'),
    (v_yoga, 'Vinyasa Flow', 'Dynamic 75-min flow.', 75, 22, 'USD', 16, '#7C3AED'),
    (v_yoga, 'Yin & Restore', 'Slow, grounded practice.', 75, 22, 'USD', 18, '#A78BFA')
  on conflict do nothing;

  -- ---------- staff ----------
  insert into public.staff (business_id, name, role, specialty, bio, rating)
  values
    (v_gym, 'Maya Okafor',     'Head Coach',     'Strength & conditioning', '8 years coaching, NSCA-CPT.',          4.95),
    (v_gym, 'Daniel Reeves',   'Coach',          'Olympic lifting',          'Former collegiate athlete.',           4.86),
    (v_salon, 'Riley Chen',     'Master Stylist', 'Precision cuts & color',  'A decade in editorial styling.',      4.92),
    (v_salon, 'Jordan Hayes',   'Senior Stylist', 'Balayage',                 'Color specialist.',                   4.78),
    (v_clinic, 'Dr. Aisha Rahman', 'Family Physician', 'Preventive care',     'Board-certified, 12 years.',          4.97),
    (v_clinic, 'Dr. Marco Vela',   'Internal Medicine', 'Cardio risk',        'Specializes in long-term care.',      4.88),
    (v_yoga, 'Sana Patel',      'Lead Teacher',   'Vinyasa & breathwork',     'E-RYT 500, 10+ years teaching.',      4.99),
    (v_yoga, 'Theo Brennan',    'Teacher',        'Yin & restorative',         'Trauma-informed practice.',           4.84)
  on conflict do nothing;

  -- ---------- time_slots: next 14 days, 8am-6pm hourly ----------
  for v_day in
    select generate_series(current_date, current_date + interval '13 days', interval '1 day')::date
  loop
    for v_hour in 8..17 loop
      v_start := (v_day::timestamp + (v_hour || ' hours')::interval) at time zone 'UTC';

      -- gym slots: pair each service with the head coach
      for v_svc, v_staff in
        select s.id, st.id
        from public.services s
        join public.staff st on st.business_id = s.business_id
        where s.business_id = v_gym
        limit 6
      loop
        insert into public.time_slots (business_id, service_id, staff_id, start_time, end_time, capacity, status)
        values (v_gym, v_svc, v_staff, v_start, v_start + interval '1 hour',
                (select capacity from public.services where id = v_svc), 'open')
        on conflict do nothing;
      end loop;

      -- salon slots
      for v_svc, v_staff in
        select s.id, st.id
        from public.services s
        join public.staff st on st.business_id = s.business_id
        where s.business_id = v_salon
        limit 6
      loop
        insert into public.time_slots (business_id, service_id, staff_id, start_time, end_time, capacity, status)
        values (v_salon, v_svc, v_staff, v_start, v_start + interval '45 minutes',
                (select capacity from public.services where id = v_svc), 'open')
        on conflict do nothing;
      end loop;

      -- clinic slots
      for v_svc, v_staff in
        select s.id, st.id
        from public.services s
        join public.staff st on st.business_id = s.business_id
        where s.business_id = v_clinic
        limit 4
      loop
        insert into public.time_slots (business_id, service_id, staff_id, start_time, end_time, capacity, status)
        values (v_clinic, v_svc, v_staff, v_start, v_start + interval '30 minutes',
                (select capacity from public.services where id = v_svc), 'open')
        on conflict do nothing;
      end loop;

      -- yoga slots (no staff selection in rules, still attach a teacher)
      for v_svc, v_staff in
        select s.id, st.id
        from public.services s
        join public.staff st on st.business_id = s.business_id
        where s.business_id = v_yoga
        limit 4
      loop
        insert into public.time_slots (business_id, service_id, staff_id, start_time, end_time, capacity, status)
        values (v_yoga, v_svc, v_staff, v_start, v_start + interval '75 minutes',
                (select capacity from public.services where id = v_svc), 'open')
        on conflict do nothing;
      end loop;
    end loop;
  end loop;

end $seed$;
