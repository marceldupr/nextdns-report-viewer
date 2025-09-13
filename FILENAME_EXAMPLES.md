# PDF Report Filename Examples

The PDF reports now use a descriptive filename format that includes device and time range information.

## Filename Format

```
device-yy-mm-dd-from-hh-mm-to-hh-mm.pdf
```

Where:
- `device`: Device identifier or "all" for all devices
- `yy-mm-dd`: Year-month-day (e.g., 25-09-13 for September 13, 2025)
- `hh-mm`: Hours-minutes in 24-hour format

## Examples

### All Devices
```
all-25-09-13-from-08-00-to-18-30.pdf
```
- All devices included
- September 13, 2025 data
- Time range: 08:00 to 18:30 SAST

### Single Device
```
marcel-iphone-25-09-13-from-10-08-to-16-45.pdf
```
- Marcel's iPhone only
- September 13, 2025 data
- Time range: 10:08 to 16:45 SAST

### Multiple Specific Devices
```
2-devices-25-09-13-from-09-15-to-17-22.pdf
```
- 2 specific devices selected
- September 13, 2025 data
- Time range: 09:15 to 17:22 SAST

### Real Examples from Your Data
```
bh02d-25-09-13-from-08-08-to-18-08.pdf
```
- Marcel iPhone (BH02D) device
- September 13, 2025 data
- Covers your Facebook messaging tests
- Time range: 08:08 to 18:08 SAST

```
all-25-09-13-from-00-00-to-23-59.pdf
```
- All devices (Marcel iPhone + iPhone)
- September 13, 2025 data
- Full day analysis
- Complete communication timeline

## Benefits

1. **Descriptive**: Immediately shows what's in the report
2. **Sortable**: Chronological sorting by date and time
3. **Device-Specific**: Clear indication of which devices are included
4. **Time-Bounded**: Exact time range for easy reference
5. **Consistent**: Same format across all reports

## Implementation Details

- Device names are sanitized (special characters → hyphens)
- Times are in SAST format (matching the report content)
- Fallbacks handle edge cases (empty data, no time range)
- Format is validated with unit tests
