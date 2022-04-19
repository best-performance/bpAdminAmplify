import { doOptionsFilteringGeneric } from './doOptionsFilteringGeneric'
// options for Wonde ANZ Test School

export function applyOptions_wondeTestingSchoolUK(
  wondeStudents, // the list to filter
  yearOptions, // contains the list of years to include
  kinterDayClasses, // set if we want to remove Kintergarten AM,PM classes
  kinterDayClassName,
  coreSubjectOption, // set if we only include core subjects
) {
  console.log('in applyOptions_wondeTestingSchoolUK()')

  // If a school uptake these parameters are set by the UI
  // After that the chosen options are saved here (ugly!)
  if (yearOptions === null) {
    yearOptions = {
      Y1: false,
      Y2: false,
      Y3: false,
      Y4: false,
      Y5: false,
      Y6: false,
      Y7: true,
      Y8: true,
      Y9: true,
      Y10: true,
      Y11: true,
      Y12: true,
      Y13: true,
      K: false,
      R: false,
      FY: false,
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
} // end function applyOptions_wonde_ANZ()
