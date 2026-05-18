-- Remove existing client-facing streak reminder notifications.
-- Background streak rows can remain for analytics/export; this only clears nudges.

delete from public.notifications
where type = 'streak_reminder';
