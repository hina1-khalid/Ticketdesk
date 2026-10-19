// Adds `minutes` of working time to `start`, honouring business hours, working days and holidays.
function addBusinessMinutes(start, minutes, bh, holidays = []) {
  const off = (bh.utcOffsetMinutes || 0) * 60000;
  const hol = new Set(holidays);
  let cur = new Date(start.getTime() + off), rem = minutes;
  for (let i = 0; i < 400; i++) {
    const y = cur.getUTCFullYear(), m = cur.getUTCMonth(), d = cur.getUTCDate();
    const dayStart = Date.UTC(y, m, d, bh.startHour), dayEnd = Date.UTC(y, m, d, bh.endHour);
    const ymd = new Date(dayStart).toISOString().slice(0, 10);
    if (bh.days.includes(new Date(dayStart).getUTCDay()) && !hol.has(ymd)) {
      const t = Math.max(cur.getTime(), dayStart);
      if (t < dayEnd) {
        const avail = (dayEnd - t) / 60000;
        if (rem <= avail) return new Date(t + rem * 60000 - off);
        rem -= avail;
      }
    }
    cur = new Date(dayStart + 24 * 3600000);
  }
  return new Date(start.getTime() + minutes * 60000);
}
function computeDue(settings, priority, from = new Date()) {
  const hrs = settings.slaHours[priority] || 24;
  return settings.businessHours.enabled ? addBusinessMinutes(from, hrs * 60, settings.businessHours, settings.holidays) : new Date(from.getTime() + hrs * 3600000);
}
module.exports = { addBusinessMinutes, computeDue };
