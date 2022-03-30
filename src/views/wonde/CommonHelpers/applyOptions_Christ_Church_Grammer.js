// Options for Christ_Church_Grammer
// This filters the studentclassroom list to remove unwanted records
// Filter Rules:
//    CristChurch grammer only has primary students (FY to year 6)
//    Classroom names contain the subject. There is no subject field.
//    Allow all core subject classrooms
//    No need to remove duplicates like FY AM,PM as in UK schools
//    We are allowing Science, English and Maths classes only
//    Subject is extracted from the classroom name
export function applyOptions_Christ_Church_Grammer(
  wondeStudents,
  yearOptions,
  kinterDayClasses,
  kinterDayClassName, // use this classroom name style if compressing classes
  coreSubjectOption,
) {
  console.log('in applyOptions_Christ_Church_Grammer()')
  console.log('Wonde list of changes to Filter[0]', wondeStudents[0])

  // If a school uptake these parameters are set by the UI
  // After that the chosen options are remembered here (ugly)
  if (yearOptions === null) {
    yearOptions = {
      // CristChurch grammer is primary only
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
    // not used in CristChurch grammer
    kinterDayClasses = false
  }
  if (kinterDayClassName === null) {
    // not used in CristChurch grammer
    kinterDayClasses = ''
  }
  if (coreSubjectOption === null) {
    // only taking core classes in CristChurch grammer
    coreSubjectOption = true
  }

  let filteredList = []

  // The data to be filtered is the raw student->classroom->teacher data read from Wonde

  wondeStudents.forEach((student) => {
    // Each student has a list of classrooms, that we have to filter
    // Must be one of the selected years

    let filteredClasses = []
    // Put a 'Y' in front of numeric keys
    let yearCode = student.year.data.code
    let studentYear = parseInt(yearCode)
    if (!isNaN(studentYear)) yearCode = `Y${yearCode}`
    if (yearOptions[yearCode]) {
      student.classes.data.forEach((classroom) => {
        if (coreSubjectOption) {
          if (classroom.name.startsWith('Mathematics')) {
            classroom.subject = 'Mathematics'
            filteredClasses.push(classroom)
          } else if (classroom.name.startsWith('English')) {
            classroom.subject = 'English'
            filteredClasses.push(classroom)
          } else if (classroom.name.startsWith('Science')) {
            classroom.subject = 'Science'
            filteredClasses.push(classroom)
          }
        } else {
          // Accept all classrooms (not likely)
          filteredClasses.push(classroom)
        }
      })
      student.classes.data = filteredClasses
      filteredList.push(student)
    } else {
      console.log('student filtered out', student)
    }
  })
  console.log('filtered list', filteredList[0])
  return filteredList
} // end function applyOptions_Christ_Church_Grammer()
