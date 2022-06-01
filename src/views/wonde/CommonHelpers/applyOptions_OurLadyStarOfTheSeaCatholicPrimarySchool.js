import { doOptionsFilteringGeneric } from './doOptionsFilteringGeneric'
// Options for applyOptions_OurLadyStarOfTheSeaCatholicPrimarySchool
// This filters the studentclassroom list to remove unwanted records
// Filter Rules:
//    Include all classrooms from Reception to year 6
//    Compress the Kindy to one class ( to be verified)
//    Include all year Levels
export function applyOptions_OurLadyStarOfTheSeaCatholicPrimarySchool(
  wondeStudents,
  yearOptions,
  kinterDayClasses,
  kinterDayClassName, // use this classroom name style if compressing classes
  coreSubjectOption,
  mergePrimaryClassesOption,
) {
  console.log('in applyOptions_OurLadyStarOfTheSeaCatholicPrimarySchool()')
  console.log('Wonde list of changes to Filter[0]', wondeStudents[0])

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
      Y7: false,
      Y8: false,
      Y9: false,
      Y10: false,
      Y11: false,
      Y12: false,
      Y13: false,
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
    mergePrimaryClassesOption,
  )
  return filteredList
} // end function applyOptions_OurLadyStarOfTheSeaCatholicPrimarySchool()
