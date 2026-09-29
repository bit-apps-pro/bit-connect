/**
 * Spread into a term table's name column.
 *
 * A term's name is whatever the site owner typed, and one unbroken word in an
 * auto-layout table sets the column's minimum width: the table grew past its
 * card and the columns after it were cut off. Breaking anywhere lets the
 * column wrap instead. Only this column — applied to every cell, it would let
 * the table squeeze short words like "Description" to a letter per line. The
 * floor keeps this one from the same fate on a phone: past it, the table
 * scrolls inside its card rather than wrapping the name a few letters a line.
 */
export const termNameColumn = {
  onCell: () => ({ style: { minWidth: '10rem', overflowWrap: 'anywhere' as const } })
}
