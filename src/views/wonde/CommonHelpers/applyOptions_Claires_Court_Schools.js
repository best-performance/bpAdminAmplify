import { doOptionsFilteringGeneric } from './doOptionsFilteringGeneric'
// Options for Claires Court School(UK)

export function applyOptions_Claires_Court_School(
  wondeStudents,
  yearOptions,
  kinterDayClasses,
  kinterDayClassName, // use this classroom name style if compressing classes
  coreSubjectOption,
) {
  console.log('in applyOptions_Claires_Court_Schools()')

  // If a school uptake these parameters are set by the UI
  // After that the chosen options are remembered here (ugly)
  if (yearOptions === null) {
    yearOptions = {
      Y0: true,
      Y1: true,
      Y2: true,
      Y3: true,
      Y4: true,
      Y5: true,
      Y6: true,
      Y7: true,
      Y8: true,
      Y9: true,
      Y10: true,
      Y11: true,
      Y12: true,
      Y13: true,
      K: true,
      R: true,
      FY: true,
    }
  }
  if (kinterDayClasses === null) {
    kinterDayClasses = false
  }
  if (kinterDayClassName === null) {
    kinterDayClasses = ''
  }
  if (coreSubjectOption === null) {
    coreSubjectOption = true
  }

  // This school can use the generic filtering function
  let filteredList = doOptionsFilteringGeneric(
    wondeStudents,
    yearOptions,
    kinterDayClasses,
    kinterDayClassName, // use this classroom name style if compressing classes
    coreSubjectOption,
  )
  return filteredList
} // end function applyOptions_Claires_Court_School()
