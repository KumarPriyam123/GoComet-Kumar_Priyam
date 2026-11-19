# Database Schema

Migration: [`backend/migrations/001_init.sql`](../backend/migrations/001_init.sql)

```mermaid
erDiagram
  suppliers ||--o{ bids : places
  rfqs ||--o{ bids : receives
  rfqs ||--o{ auction_activity_logs : has
  bids ||--o{ auction_activity_logs : "referenced by"

  suppliers {
    serial id PK
    text name UK
    timestamptz created_at
  }
  rfqs {
    serial id PK
    text reference_id UK
    text name
    date pickup_date
    timestamptz bid_start_time
    timestamptz original_close_time
    timestamptz current_close_time
    timestamptz forced_close_time
    int trigger_window_minutes
    int extension_minutes
    extension_trigger extension_trigger
    auction_status status
    timestamptz created_at
  }
  bids {
    serial id PK
    int rfq_id FK
    int supplier_id FK
    text carrier_name
    numeric freight_charges
    numeric origin_charges
    numeric destination_charges
    numeric total_price "generated"
    int transit_time_days
    date quote_validity_date
    timestamptz created_at
  }
  auction_activity_logs {
    serial id PK
    int rfq_id FK
    activity_event event_type
    int bid_id FK
    timestamptz old_close_time
    timestamptz new_close_time
    text reason
    timestamptz created_at
  }
```

## Tables

### `suppliers`
The companies that bid. There's no login in this project, so the bid form picks a supplier from this table.

### `rfqs`
| Column | Notes |
|---|---|
| `reference_id` | Unique, e.g. `RFQ-2026-001` |
| `original_close_time` | Never changes. Kept so the UI can show how much the auction was extended. |
| `current_close_time` | Moves forward on each extension |
| `forced_close_time` | Hard limit. Never changes. |
| `trigger_window_minutes` / `extension_minutes` | X and Y, both > 0 |
| `extension_trigger` | `ANY_BID`, `ANY_RANK_CHANGE`, `L1_CHANGE` |
| `status` | `SCHEDULED`, `ACTIVE`, `CLOSED`, `FORCE_CLOSED`. Kept in sync by the close job; the API computes status from the clock. |

Constraints:
- `original_close_time > bid_start_time`
- `forced_close_time > original_close_time`
- `original_close_time <= current_close_time <= forced_close_time`. The last part is the "never extend past forced close" rule. It uses `<=` rather than `<`, because an auction extended right up to the cap has `current = forced`.

### `bids`
| Column | Notes |
|---|---|
| `freight_charges`, `origin_charges`, `destination_charges` | `NUMERIC(12,2)`, each ≥ 0 |
| `total_price` | Generated column (sum of the three), so it can never disagree with the charges. Must be > 0. |
| `created_at` | Set by the server inside the bid transaction, not by the client |

Bids are never updated. Every new price is a new row, so the history stays complete. `id` is serial, so it also gives the order bids were accepted, which is used to break ties ("whoever bid first keeps the rank").

### `auction_activity_logs`
One row per event: `RFQ_CREATED`, `BID_SUBMITTED`, `TIME_EXTENDED`, `AUCTION_CLOSED`, `AUCTION_FORCE_CLOSED`. Extensions store the old and new close time and a readable reason, e.g. *"L1 changed from BlueOcean Freight to FastShip Logistics within the last 2 minutes"*.

## Indexes

| Index | Used by |
|---|---|
| `bids (rfq_id, total_price, id)` | Lowest bid per RFQ on the listing page; ranked bid list |
| `bids (rfq_id, supplier_id)` | Loading a supplier's previous bids |
| `auction_activity_logs (rfq_id, created_at, id)` | Activity log in time order |
| `rfqs (status, current_close_time)` | The close job finding auctions that have ended |
