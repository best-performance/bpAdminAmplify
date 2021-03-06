import { doOptionsFilteringGeneric } from './doOptionsFilteringGeneric'
// options for Wonde ANZ Test School

export function applyOptions_wonde_ANZ(
  wondeStudents, // the list to filter
  yearOptions, // contains the list of years to include
  kinterDayClasses, // set if we want to remove Kintergarten AM,PM classes
  kinterDayClassName,
  coreSubjectOption, // set if we only include core subjects
) {
  console.log('in applyOptions_wonde_ANZ()')

  // If a school uptake these parameters are set by the UI
  // After that the chosen options are remembered here (ugly)
  if (yearOptions === null) {
    yearOptions = {
      // Wonde ANZ Test School has all years up to Y12
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
      Y13: false,
      K: true,
      R: true,
      FY: true,
    }
  }
  if (kinterDayClasses === null) {
    // not used in Wonde ANZ Test School
    kinterDayClasses = false
  }
  if (kinterDayClassName === null) {
    // not used in Wonde ANZ Test School
    kinterDayClasses = ''
  }
  if (coreSubjectOption === null) {
    // only taking core classes in Wonde ANZ Test School
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
} // end function applyOptions_wonde_ANZ()
