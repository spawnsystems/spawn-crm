-- 025 — Datos del comprador confirmados al registrar la venta.
-- El formulario de "Registrar venta" ahora captura y confirma los datos de
-- contacto del comprador: teléfono (confirmación), teléfono alternativo, DNI
-- y email (obligatorio). Se guardan como snapshot en el registro de la venta.

ALTER TABLE registro_ventas
  ADD COLUMN IF NOT EXISTS comprador_telefono     text,
  ADD COLUMN IF NOT EXISTS comprador_telefono_alt text,
  ADD COLUMN IF NOT EXISTS comprador_dni          text,
  ADD COLUMN IF NOT EXISTS comprador_email        text;
