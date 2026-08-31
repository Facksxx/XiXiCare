# XIXI CARE uniCloud sync

Domestic cloud archive backend for the `xixi-care` Alipay Cloud service space.

- Space ID: `env-00jy6pn3o40f`
- Function: `xixi-sync`
- Collection: `xixi_archive_meta`
- URL path: `/xixi-sync`

The Android client sends an AES-GCM encrypted envelope. The function stores the
envelope in private cloud storage and keeps only file metadata in the database.
No baby record is decrypted by the backend.

## Deploy

1. In HBuilderX, associate `uniCloud-alipay` with the `xixi-care` service space.
2. Upload `uniCloud-alipay/cloudfunctions/xixi-sync` as a cloud function.
3. Initialize the database from `uniCloud-alipay/database`.
4. URL access is configured as `/xixi-sync` in the function's `package.json`.
5. Set the production client endpoint to the resulting URL.

The function accepts:

- `GET /xixi-sync/archive/{6-digit-code}-{yyyymmdd}`
- `PUT /xixi-sync/archive/{6-digit-code}-{yyyymmdd}`
- `GET /xixi-sync/health`
