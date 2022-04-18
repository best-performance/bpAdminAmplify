import { doOptionsFilteringGeneric } from './doOptionsFilteringGeneric'
// Options for English Martyrs Catholic PrimarySchool
export function applyOptions_EnglishMartyrsCatholicPrimarySchool(
  wondeStudents,
  yearOptions,
  kinterDayClasses,
  kinterDayClassName, // use this classroom name style if compressing classes
  coreSubjectOption,
) {
  console.log('in applyOptions_EnglishMartyrsCatholicPrimarySchool()')
  console.log('Wonde list of changes to Filter[0]', wondeStudents[0])
  console.log('coreSubjectOption', coreSubjectOption)

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
    kinterDayClasses = true
  }
  if (kinterDayClassName === null) {
    kinterDayClasses = 'K-Mon-Fri'
  }
  if (coreSubjectOption === null) {
    coreSubjectOption = false
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
} // end function applyOptions_EnglishMartyrsCatholicPrimarySchool()
