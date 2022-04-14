import _ from 'lodash'
// Options for Christ_Church_Grammer
// This filters the studentclassroom list to remove unwanted records
// Filter Rules:
//    Claires Court fill in the subject field of interestimg classes.
//    Uninteresting classes have subject : null
//    Allow all core subject classrooms
//    Not yet removing duplicates of FY etc
//    Pass Science, English and Maths classes only
export function applyOptions_Claires_Court_Schools(
  wondeStudents,
  yearOptions,
  kinterDayClasses,
  kinterDayClassName, // use this classroom name style if compressing classes
  coreSubjectOption,
) {
  console.log('in applyOptions_Claires_Court_Schools()')
  console.log('Wonde list of changes to Filter[0]', wondeStudents[0])

  // Clone since we are doing updates
  let wondeStudentsCloned = _.cloneDeep(wondeStudents)

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
    // not used in Claires Court
    kinterDayClasses = false
  }
  if (kinterDayClassName === null) {
    // not used in Claires Court
    kinterDayClasses = ''
  }
  if (coreSubjectOption === null) {
    // only taking core classes in Claires Court
    coreSubjectOption = true
  }

  let filteredList = []

  // The data to be filtered is the raw student->classroom->teacher data read from Wonde

  wondeStudentsCloned.forEach((student, index) => {
    // Each student has a list of classrooms, that we have to filter
    // Must be one of the selected years

    let filteredClasses = []
    // Put a 'Y' in front of numeric keys
    let yearCode = student.yearCode
    let studentYear = parseInt(yearCode)
    if (!isNaN(studentYear)) yearCode = `Y${yearCode}`
    if (yearOptions[yearCode]) {
      student.classes.data.forEach((classroom) => {
        if (coreSubjectOption) {
          if (classroom.subject) {
            // in Claires Court subject is an object
            // but its null for uninteresting classes - like "assembly"
            if (classroom.subject.data.name.startsWith('Mathematics')) {
              classroom.subject = 'Mathematics'
              filteredClasses.push(classroom)
            } else if (classroom.subject.data.name.startsWith('English')) {
              classroom.subject = 'English'
              filteredClasses.push(classroom)
            } else if (classroom.subject.data.name.startsWith('Science')) {
              classroom.subject = 'Science'
              filteredClasses.push(classroom)
            }
          }
        } else {
          // Accept all classrooms (not likely)
          filteredClasses.push(classroom)
        }
      })
      if (student.classes.data.length > 0) {
        // a student must have at least one core class
        student.classes.data = filteredClasses
        filteredList.push(student)
      } else {
        console.log(`No core classes - student filtered out`, student)
      }
    } else {
      console.log(`yearcode ${student.yearCode} bad - student filtered out`, student)
    }
  })
  console.log('filtered list', filteredList[0])
  return filteredList
} // end function applyOptions_Claires_Court_Schools()
