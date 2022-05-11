import _ from 'lodash'
// This is a generic filtering function that should be OK for most schools
export function doOptionsFilteringGeneric(
  wondeStudents, // as read by getStudentsFromWonde() BEFORE formatStudentClassrooms()
  yearOptions, // array of years to include
  kinterDayClasses, // true if compressing Kindy Classes
  kinterDayClassName, // use this classroom name style if compressing Kindy Classes
  coreSubjectOption, // true if accepting classes with core subjects only
) {
  let filteredList = []

  // The data to be filtered is the raw student->classroom->teacher data read from Wonde
  // Clone since we are doing updates
  let wondeStudentsCloned = _.cloneDeep(wondeStudents)
  console.log('cloned student classroom', wondeStudentsCloned)
  wondeStudentsCloned.forEach((student) => {
    // Each student has a list of classrooms, that we have to filter
    // Must be one of the selected years

    // use this variable to eliminate duplicate classes for Kindy students
    let currentStudentWondeId = null
    let filteredClasses = []
    // Put a 'Y' in front of numeric keys
    let yearCode = student.yearCode
    let studentYear = parseInt(yearCode)
    if (!isNaN(studentYear)) yearCode = `Y${yearCode}`
    if (yearOptions[yearCode]) {
      student.classes.data.forEach((classroom) => {
        // remove duplicate Kindy classes based on Mon-AM etc
        // for now we remove all duplicate classrooms
        if (kinterDayClasses && yearCode === 'K') {
          if (
            !currentStudentWondeId ||
            (currentStudentWondeId && currentStudentWondeId !== student.id)
          ) {
            // Creating a new object to avoid changing the original classroom value of the student
            currentStudentWondeId = student.id
            filteredClasses.push({
              ...classroom,
              name: kinterDayClassName ? kinterDayClassName : 'K-Kindy',
              subject: 'Kindy',
            })
          }
        } else {
          if (coreSubjectOption) {
            let subjectName = null
            // Try to find a subject so we can later add classroomLearningArea
            // If subject not stated explicitely, then classroom names could provide a hints
            if (classroom.subject && classroom.subject.data && classroom.subject.data.name) {
              subjectName = classroom.subject.data.name
            } else if (classroom.subject && typeof classroom.subject === 'string') {
              subjectName = classroom.subject
            } else if (classroom.name) subjectName = classroom.name

            // Some schools have Science but also Physics, chemistry, Biology
            // Traps here might be "Domestic Science" maybe also "English Literature"
            if (subjectName) {
              if (subjectName.includes('Mathematics') || subjectName.includes('Maths')) {
                classroom.subject = 'Mathematics'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('English')) {
                classroom.subject = 'English'
                filteredClasses.push(classroom)
              } else if (
                subjectName.includes('Science') &&
                !subjectName.includes('Domestic') &&
                !subjectName.includes('Social')
              ) {
                classroom.subject = 'Science'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('Biology')) {
                classroom.subject = 'Science (Bi)'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('Chemistry')) {
                classroom.subject = 'Science (Ch)'
                filteredClasses.push(classroom)
              } else if (subjectName.includes('Physics')) {
                classroom.subject = 'Science (Ph)'
                filteredClasses.push(classroom)
              }
            } else {
              // Not a core subject so filtered out
            }
          } else {
            // Accept all classrooms
            filteredClasses.push(classroom)
          }
        }
      })
      if (student.classes.data.length > 0) {
        // a student must have at least one class
        student.classes.data = filteredClasses
        filteredList.push(student)
      } else {
        console.log(`student has no core classes - filtered out`, student)
      }
    } else {
      console.log(`Student yearcode ${student.yearCode} - filtered out`, student)
    }
  })
  console.log('filtered list[0]', filteredList[0])
  return filteredList
} // end doOptionsFilteringGeneric()
