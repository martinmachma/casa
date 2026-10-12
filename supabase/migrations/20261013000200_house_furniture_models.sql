-- Furniture can be a catalog model (stretched to its size) instead of a plain box.
alter table house.furniture_items
  add column model text check (model ~ '^[A-Za-z0-9]{1,40}$');  -- model file in public/models/furniture, null = box
