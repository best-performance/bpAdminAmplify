// retrun a year level that matches the supplied year code.
export function getNumericYearLevel(yearCode) {
  switch (yearCode) {
    case 'K':
      return -1
    case 'FY':
    case 'R':
      return 0
    default:
      return parseInt(yearCode)
  }
}
