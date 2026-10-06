export const itemColors = ['#3d8b67', '#e06445', '#5276b8', '#b48738', '#8a63a8', '#555b63']
export const defaultHabitColor = '#3d8b67'
export function checkedColor(color: string) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('색상은 올바른 HEX 값으로 선택해주세요.')
  return color.toLowerCase()
}
export function projectColor(project: { id: string; color?: string }) {
  if (project.color && /^#[0-9a-f]{6}$/i.test(project.color)) return project.color
  const palette = ['#3d8b67', '#5276b8', '#b48738', '#8a63a8', '#e06445']
  const hash = Array.from(project.id).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return palette[hash % palette.length]
}
