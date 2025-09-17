# Read the uploaded file, parse it, and generate the SQL UPDATE with CASE mapping.
# Save the full SQL to /mnt/data/update_onu_from_onulist2.sql and also print a short preview.

import re
from pathlib import Path

src = Path("/mnt/data/ONUList2.txt")
text = src.read_text(encoding="utf-8", errors="ignore")

lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
# Skip header
header = lines[0]
rows = lines[1:]

def extract_login(device_name: str) -> str:
    # take the piece after the last underscore
    suffix = device_name.split("_")[-1]
    # normalize: strip and collapse spaces, keep only letters/numbers
    # (Common DB logins here appear uppercase + ascii, so we'll mirror that)
    cleaned = re.sub(r"[^A-Za-z0-9]", "", suffix).upper()
    return cleaned

pairs = []
for ln in rows:
    parts = ln.split("|")
    if len(parts) < 6:
        continue
    device_name = parts[1].strip()
    try:
        onu_number_str = parts[5].strip()
        if not onu_number_str:
            continue
        onu_number = int(onu_number_str)
    except Exception:
        continue
    login = extract_login(device_name)
    if login:
        pairs.append((login, onu_number))

# De-duplicate while preserving first occurrence
seen = set()
unique_pairs = []
for login, num in pairs:
    if login not in seen:
        unique_pairs.append((login, num))
        seen.add(login)

# Build SQL
case_lines = [f"    WHEN '{login}' THEN {num}" for login, num in unique_pairs]
in_list = ", ".join([f"'{login}'" for login, _ in unique_pairs])

sql = (
    "UPDATE mkradius.sis_cliente\n"
    "SET onu_ont = CASE login\n"
    + "\n".join(case_lines) + "\n"
    "END\n"
    "WHERE login IN (\n    " + in_list + "\n);\n"
)

# Save to file
out_path = Path("/mnt/data/update_onu_from_onulist2.sql")
out_path.write_text(sql, encoding="utf-8")

# Show a short preview (first 25 WHENs)
preview = "UPDATE mkradius.sis_cliente\nSET onu_ont = CASE login\n" + \
          "\n".join(case_lines[:25]) + "\n    ...\nEND;\n"

print("Preview of generated SQL (truncated):\n")
print(preview)
print("\nTotal logins mapped:", len(unique_pairs))
print("\nSaved to:", out_path)
