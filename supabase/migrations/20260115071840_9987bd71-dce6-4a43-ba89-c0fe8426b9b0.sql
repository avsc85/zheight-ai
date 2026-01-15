-- Soft-delete duplicate project records, keeping only the most recently created one for each duplicate project name
-- This updates deleted_at instead of hard-deleting to preserve data integrity

UPDATE projects 
SET deleted_at = now()
WHERE id IN (
  -- 1645 Kennewick Drive, Sunnyvale - keep 44e2f04a (latest), delete e33dbc14
  'e33dbc14-d848-4d0c-b659-d74543822178',
  -- 1769 OLD TOWER RD, LIVERMORE - keep ad5618e9 (latest), delete 1b569f56
  '1b569f56-7b9e-4c97-a9f3-5afb567e8780',
  -- 1814 Macduee Way 12.09 First Review - keep aa108111 (latest), delete 37eb1d8d
  '37eb1d8d-b9e4-4370-8a9f-94c22d24d7a8',
  -- 185 RADFORD DR, CAMPBELL - keep 5b08ba41 (latest), delete 9ebcd217
  '9ebcd217-fb0d-4360-9c11-ca45f3b93dc2',
  -- 2213 FOXWORTHY AVE, SAN JOSE - keep 58e6dbbe (latest), delete 07e7e0b7
  '07e7e0b7-a42f-4c79-b9de-0aa25a3405c2',
  -- 27201 FREMONT RD, LOS ALTOS HILLS - keep e463d465 (latest), delete e28064ff
  'e28064ff-29c2-48af-bf69-5e090d65c4e6',
  -- 464 FATHOM DR, SAN MATEO - keep 6b9d7c81 (latest), delete 6e18ce1c
  '6e18ce1c-e8e4-4903-ba1e-adcd0244ab14',
  -- 517 HELEN DR, MILLBRAE - keep de65a2b5 (latest), delete c7bac2a4
  'c7bac2a4-14f1-4e4e-b9d8-97d5fd8e8389',
  -- 555 Claremont Drive - keep 28b24c44 (today), delete 02b86244 (Oct 2025)
  '02b86244-e959-44eb-a4e4-9adec43b2496',
  -- Title 24 - keep 350f17ae (Dec 2025), delete 240679ed (Sep 2025)
  '240679ed-8d90-4fa9-ac40-78f57e5b3a76'
)