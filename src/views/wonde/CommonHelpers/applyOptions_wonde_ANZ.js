// options for Wonde ANZ Test School
// This filters the studentclassroom list to remove unwanted records
// NB: The records are not changed in any way - just pass,block is applied
// Filter Rules for wonde ANZ test school
// Remove years > Y 13 ( there rea Y20 and Y40 in Wonde)
// There are no FY or K classes in Wonde
// We are allowing Science, English and Maths classes only
// Subject is extracted from the classroom name
export function applyOptions_wonde_ANZ(
  wondeStudents, // the list to filter
  yearOptions, // contains the list of years to include
  kinterDayClasses, // set if we want to remove Kintergarten AM,PM classes
  kinterDayClassName,
  coreSubjectOption, // set if we only include core subjects
) {
  // when we reach here the year levels are all good or UNKNOWN ((Remove later))
  // The list is filtered by wondeStudentId
  console.log('in applyOptions_wonde_ANZ()')
  console.log('coreSubjectOption', coreSubjectOption)
  console.log('year Options', yearOptions)
  console.log('listToFilter', wondeStudents)

  // If a school uptake these parameters are set by the UI
  // After that the chosen options are saved here (ugly!)
  // to replicate the filtering when processing updates
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

  let filteredList = []

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
          // we accept all classrooms (not likely)
          filteredClasses.push(classroom)
        }
      })
      student.classes.data = filteredClasses
      filteredList.push(student)
    } else {
      console.log('student filtered out', student)
    }
  })
  console.log('filtered list', filteredList)
  return filteredList
} // end function applyOptions_wonde_ANZ()
