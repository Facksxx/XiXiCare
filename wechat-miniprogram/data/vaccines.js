const schedule = require('./vaccineSchedule');
function dueDate(birthday, monthOffset) {
  if (!birthday) return '';
  const parts = birthday.split('-').map(Number);
  const months = Math.floor(monthOffset);
  const extraDays = Math.round((monthOffset - months) * 30);
  const first = new Date(parts[0], parts[1] - 1 + months, 1);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const date = new Date(first.getFullYear(), first.getMonth(), Math.min(parts[2],last) + extraDays);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
module.exports = { schedule, dueDate };
