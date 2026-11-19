CREATE TYPE extension_trigger AS ENUM ('ANY_BID', 'ANY_RANK_CHANGE', 'L1_CHANGE');
CREATE TYPE auction_status AS ENUM ('SCHEDULED', 'ACTIVE', 'CLOSED', 'FORCE_CLOSED');
CREATE TYPE activity_event AS ENUM (
  'RFQ_CREATED',
  'BID_SUBMITTED',
  'TIME_EXTENDED',
  'AUCTION_CLOSED',
  'AUCTION_FORCE_CLOSED'
);

CREATE TABLE suppliers (
  id         SERIAL PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE rfqs (
  id                     SERIAL PRIMARY KEY,
  reference_id           TEXT NOT NULL UNIQUE,
  name                   TEXT NOT NULL,
  pickup_date            DATE NOT NULL,
  bid_start_time         TIMESTAMPTZ NOT NULL,
  original_close_time    TIMESTAMPTZ NOT NULL,
  current_close_time     TIMESTAMPTZ NOT NULL,
  forced_close_time      TIMESTAMPTZ NOT NULL,
  trigger_window_minutes INTEGER NOT NULL CHECK (trigger_window_minutes > 0),
  extension_minutes      INTEGER NOT NULL CHECK (extension_minutes > 0),
  extension_trigger      extension_trigger NOT NULL,
  status                 auction_status NOT NULL DEFAULT 'SCHEDULED',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT rfqs_close_after_start CHECK (original_close_time > bid_start_time),
  CONSTRAINT rfqs_forced_after_close CHECK (forced_close_time > original_close_time),
  CONSTRAINT rfqs_current_close_in_range CHECK (
    current_close_time >= original_close_time AND current_close_time <= forced_close_time
  )
);

CREATE INDEX rfqs_status_close_idx ON rfqs (status, current_close_time);

CREATE TABLE bids (
  id                  SERIAL PRIMARY KEY,
  rfq_id              INTEGER NOT NULL REFERENCES rfqs (id) ON DELETE CASCADE,
  supplier_id         INTEGER NOT NULL REFERENCES suppliers (id),
  carrier_name        TEXT NOT NULL,
  freight_charges     NUMERIC(12, 2) NOT NULL CHECK (freight_charges >= 0),
  origin_charges      NUMERIC(12, 2) NOT NULL CHECK (origin_charges >= 0),
  destination_charges NUMERIC(12, 2) NOT NULL CHECK (destination_charges >= 0),
  total_price         NUMERIC(12, 2) GENERATED ALWAYS AS
                        (freight_charges + origin_charges + destination_charges) STORED,
  transit_time_days   INTEGER NOT NULL CHECK (transit_time_days > 0),
  quote_validity_date DATE NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL,

  CONSTRAINT bids_total_positive CHECK (total_price > 0)
);

CREATE INDEX bids_rfq_price_idx ON bids (rfq_id, total_price, id);
CREATE INDEX bids_rfq_supplier_idx ON bids (rfq_id, supplier_id);

CREATE TABLE auction_activity_logs (
  id             SERIAL PRIMARY KEY,
  rfq_id         INTEGER NOT NULL REFERENCES rfqs (id) ON DELETE CASCADE,
  event_type     activity_event NOT NULL,
  bid_id         INTEGER REFERENCES bids (id) ON DELETE CASCADE,
  old_close_time TIMESTAMPTZ,
  new_close_time TIMESTAMPTZ,
  reason         TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX activity_rfq_created_idx ON auction_activity_logs (rfq_id, created_at, id);
