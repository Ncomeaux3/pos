-- Workout distance to the centimetre. Whole metres lost a yard on a pool
-- swim (625 yd is 571.5 m, stored as 572 and read back as 626 yd); every
-- source sends a decimal distance, so the column keeps two places.
alter table fitness.workout
  alter column distance_m type numeric(10,2) using distance_m::numeric(10,2);
