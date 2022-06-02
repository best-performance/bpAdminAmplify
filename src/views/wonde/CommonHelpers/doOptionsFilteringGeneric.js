import _ from 'lodash'
import { getYearCodeForYear0 } from './featureToggles'

// Utility to remove spaces and hyphens from string and convert to upper case
// Note compressString() duplicated in several modules
function compressString(str) {
  return str.replace(/'|\s/g, '').toUpperCase()
}

// Local utility return true if the yearCode is Y0 - Y6, otherwise false
function isPrimary(yearCode) {
  let Y0 = getYearCodeForYear0() // its region dependant
  switch (yearCode) {
    case Y0:
    case 'Y1':
    case 'Y2':
    case 'Y3':
    case 'Y4':
    case 'Y5':
    case 'Y6':
      return true
    default:
      return false
  }
}

/**
 * doOptionsFilteringGeneric() works like this:
 * Every student record in wondeStudents has a list of classes as student.classes
 * We process every student and alter student.classes according to the options requested
 * We filter out students that are not in the selected years
 * We filter out students that have no classes (conditional)
 * We filter out classes that dont meet the options criteria
 * students.forEach
 *   let filteredClasses[] = []
 *   let excludedStudents[] =[]
 *   Is student's year code included?
 *      no (not an included year)
 *        excludedStudents.push(student)
 *        return
 *      yes
 *          Classroom.forEach
 *          {
 *              is (student a Kindy)?
 *                 yes (student is Kindy)
 *                    is the kinterDayClasses set?
 *                        no - then push the classroom untouched to filteredClasses[]
 *                        yes - if filteredClassroom[] is empty push the classroom to filteredClasses[]
 *                 no (student not Kindy)
 *                    is coreSubjectOption set?
 *                        yes (coreSubjectOption is set)
 *                           is the subject a core subject?
 *                               yes (is a core subject)
 *                                  push the classroom to filteredClasses[]
 *                               no (not a core subject)
 *                                   skip the classroom - do nothing
 *                         no (coreSubjectOption not set)
 *                             push the classroom to filteredClasses[]
 *           }
 *           is this a primary class (years 0-6) && meregePrimaryClasses set?
 *                  yes (is Primary and mergePrimaryClasses)
 *                      merge the classes in filteredClasses[] into one class
 *            Does FilteredClasses[] have at least one class?
 *              yes (student has valid classes)
 *                 push student to filteredWondeStudent[]
 *              no (student has no valid classes)
 *                 is the keepClasslessStudent option set
 *                     yes (keepClasslessStudent is set)
 *                         push student to filteredWondeStudent[]
 *                     no (keepClasslessStudent not set)
 *                         push student to excludedStudnets[]
 *  student.ForEach end
 */
// This is a generic filtering function that should be OK for most schools
export function doOptionsFilteringGeneric(
  wondeStudents, // as read by getStudentsFromWonde() BEFORE formatStudentClassrooms()
  yearOptions, // array of years to include
  kinterDayClasses, // true if compressing Kindy Classes
  kinterDayClassName, // use this classroom name style if compressing Kindy Classes
  coreSubjectOption, // true if accepting classes with core subjects only
  mergePrimaryClassesOption, // true if we want to merge primary classes with the same teacher
) {
  let keepStudentsWithoutClassesOption = false // TODO Needs to be made an option in OptionsPopup

  let filteredWondeStudents = [] // the final filtered student->classes->teachers
  let excludedWondeStudents = [] // students removed that did not meet the criteria
  let excludedClasses = [] // classes removed that did not meet the criteria (for a student)

  // The data to be filtered is the raw student->classroom->teacher data read from Wonde
  let wondeStudentsCloned = _.cloneDeep(wondeStudents)
  console.log('cloned student classroom', wondeStudentsCloned)
  wondeStudentsCloned.forEach((student) => {
    let filteredClasses = []
    // make a useable year code to compare with yearOptions[yearCode]
    let yearCode = student.yearCode
    let studentYear = parseInt(yearCode)
    if (!isNaN(studentYear)) yearCode = `Y${yearCode}`

    // is the student from a required year level?
    if (!yearOptions[yearCode]) {
      student.reason = 'Unrequired year'
      excludedWondeStudents.push(student) // for possible debugging - need to add reason
      return // "if - return" not best
    }
    student.classes.data.forEach((classroom) => {
      // remove duplicate Kindy classes based on Mon-AM etc
      // for now we remove all duplicate classrooms
      if (yearCode === 'K') {
        if (kinterDayClasses) {
          // Then only save if its the first classroom for that student
          if (filteredClasses.length === 0)
            filteredClasses.push({
              ...classroom,
              name: kinterDayClassName ? kinterDayClassName : 'K-Kindy', // change the name if req
              subject: 'Kindy',
            })
        } else {
          // (kinterDayClasses not set) save the classroom - leaving the name intact
          filteredClasses.push({
            ...classroom,
            subject: 'Kindy',
          })
        }
      } else {
        // (Student is not Kindy)
        if (coreSubjectOption) {
          let subjectName = null
          // Try to find a subject so we can later add classroomLearningArea
          // If subject not stated explicitely, then classroom names could provide a hints
          // Note: next instruction is duplicated in formStudentClassrooms() - see notes there for why
          if (classroom.subject && classroom.subject.data && classroom.subject.data.name) {
            subjectName = classroom.subject.data.name
          } else if (classroom.subject && typeof classroom.subject === 'string') {
            subjectName = classroom.subject
          } else if (classroom.name) subjectName = classroom.name

          // Some schools have Science but also Physics, chemistry, Biology
          // Traps here might be like "Domestic Science" or "Kitches Chemistry"
          if (subjectName) {
            subjectName = compressString(subjectName) // convert to upper case and remove spaces
            if (
              (subjectName.includes('MATHEMATIC') || subjectName.includes('MATH')) &&
              subjectName.length < 20 //try to get rid of special math events that are not classes
            ) {
              classroom.subject = 'Mathematics'
              filteredClasses.push(classroom)
            } else if (subjectName.includes('ENGLISH')) {
              classroom.subject = 'English'
              filteredClasses.push(classroom)
            } else if (
              subjectName.includes('SCIENCE') &&
              !subjectName.includes('KITCHEN') &&
              !subjectName.includes('DOMESTIC') &&
              !subjectName.includes('SOCIAL')
            ) {
              classroom.subject = 'Science'
              filteredClasses.push(classroom)
            } else if (subjectName.includes('BIOLOGY')) {
              classroom.subject = 'Science (Bi)'
              filteredClasses.push(classroom)
            } else if (subjectName.includes('CHEMISTRY') && !subjectName.includes('KITCHEN')) {
              classroom.subject = 'Science (Ch)'
              filteredClasses.push(classroom)
            } else if (subjectName.includes('PHYSICS')) {
              classroom.subject = 'Science (Ph)'
              filteredClasses.push(classroom)
            }
          } else {
            classroom.reason = 'Not core subject'
            classroom.student = student.firstName + ' ' + student.lastName
            excludedClasses.push(classroom) // for possible debugging
          }
        } else {
          // CoreSubject option not set so push it untouched
          filteredClasses.push(classroom)
        }
      }
    }) // end Classrooms.foreach()

    // is this a primary class with mergePrimaryClasses set?
    if (isPrimary(yearCode) && mergePrimaryClassesOption && filteredClasses.length > 0) {
      // merge the classes into groups with common teachers
      // find the number of unique teachers
      console.log('Classes to merge', filteredClasses)
      let uniqueTeachersMap = new Map()
      filteredClasses.forEach((filteredClass) => {
        // for now assume just one teacher (need to expand this)
        // also assuming .employees exists! Need to check this espeecially for groups
        let teacherID = filteredClass.employees.data[0].id
        if (!uniqueTeachersMap.get(teacherID)) uniqueTeachersMap.set(teacherID, teacherID)
      })
      if (uniqueTeachersMap.size === 1) {
        let mergedClass = _.cloneDeep(filteredClasses[0])
        mergedClass.name = yearCode
        mergedClass.subject = 'All'
        filteredClasses = [] // empty the array
        filteredClasses.push(mergedClass) // add the merged one back in
        console.log('Merged Class', mergedClass)
      }
    }
    // does the student have at least one class
    if (student.classes.data.length > 0) {
      student.classes.data = filteredClasses
      filteredWondeStudents.push(student)
    } else {
      // do we keep students with no classes
      if (keepStudentsWithoutClassesOption) {
        filteredWondeStudents.push(student)
      } else {
        student.reason = 'Has no classes'
        excludedWondeStudents.push(student) // for possible debugging - need to add reason
      }
    }
  }) // end students.forEach()

  console.log('filteredWondeStudents[0]', filteredWondeStudents[0])
  console.log('No of students processed', wondeStudents.length)
  console.log('No of students passed', filteredWondeStudents.length)
  console.log('No of students excluded', excludedWondeStudents.length)
  console.log('No of classes excluded', excludedClasses.length)
  return filteredWondeStudents
} // end doOptionsFilteringGeneric()

// This is a generic filtering function that should be OK for most schools
// export function doOptionsFilteringGenericOld(
//   wondeStudents, // as read by getStudentsFromWonde() BEFORE formatStudentClassrooms()
//   yearOptions, // array of years to include
//   kinterDayClasses, // true if compressing Kindy Classes
//   kinterDayClassName, // use this classroom name style if compressing Kindy Classes
//   coreSubjectOption, // true if accepting classes with core subjects only
//   mergePrimaryClassesOption, // true if we want to merge primary classes with the same teacher
// ) {
//   let filteredWondeStudents = []

//   // The data to be filtered is the raw student->classroom->teacher data read from Wonde
//   // Clone since we are doing updates
//   let wondeStudentsCloned = _.cloneDeep(wondeStudents)
//   console.log('cloned student classroom', wondeStudentsCloned)
//   wondeStudentsCloned.forEach((student) => {
//     // Each student has a list of classrooms, that we have to filter
//     // Must be one of the selected years

//     // use this variable to eliminate duplicate classes for Kindy students
//     let currentStudentWondeId = null
//     let filteredClasses = []
//     // Put a 'Y' in front of numeric keys
//     let yearCode = student.yearCode
//     let studentYear = parseInt(yearCode)
//     if (!isNaN(studentYear)) yearCode = `Y${yearCode}`
//     if (yearOptions[yearCode]) {
//       student.classes.data.forEach((classroom) => {
//         // remove duplicate Kindy classes based on Mon-AM etc
//         // for now we remove all duplicate classrooms
//         if (kinterDayClasses && yearCode === 'K') {
//           if (
//             !currentStudentWondeId ||
//             (currentStudentWondeId && currentStudentWondeId !== student.id)
//           ) {
//             // Creating a new object to avoid changing the original classroom value of the student
//             currentStudentWondeId = student.id
//             filteredClasses.push({
//               ...classroom,
//               name: kinterDayClassName ? kinterDayClassName : 'K-Kindy',
//               subject: 'Kindy',
//             })
//           }
//         } else {
//           if (coreSubjectOption) {
//             let subjectName = null
//             // Try to find a subject so we can later add classroomLearningArea
//             // If subject not stated explicitely, then classroom names could provide a hints
//             // Note: next tests are duplicated in formStudentClassrooms() - see notes there for why
//             if (classroom.subject && classroom.subject.data && classroom.subject.data.name) {
//               subjectName = classroom.subject.data.name
//             } else if (classroom.subject && typeof classroom.subject === 'string') {
//               subjectName = classroom.subject
//             } else if (classroom.name) subjectName = classroom.name

//             // Some schools have Science but also Physics, chemistry, Biology
//             // Traps here might be "Domestic Science" maybe also "English Literature"
//             if (subjectName) {
//               subjectName = compressString(subjectName) // convert to upper case and remove spaces
//               if (
//                 (subjectName.includes('MATHEMATIC') || subjectName.includes('MATH')) &&
//                 subjectName.length < 20 //try to get rid of special math events that are not classes
//               ) {
//                 classroom.subject = 'Mathematics'
//                 filteredClasses.push(classroom)
//               } else if (subjectName.includes('ENGLISH')) {
//                 classroom.subject = 'English'
//                 filteredClasses.push(classroom)
//               } else if (
//                 subjectName.includes('SCIENCE') &&
//                 !subjectName.includes('KITCHEN') &&
//                 !subjectName.includes('DOMESTIC') &&
//                 !subjectName.includes('SOCIAL')
//               ) {
//                 classroom.subject = 'Science'
//                 filteredClasses.push(classroom)
//               } else if (subjectName.includes('BIOLOGY')) {
//                 classroom.subject = 'Science (Bi)'
//                 filteredClasses.push(classroom)
//               } else if (subjectName.includes('CHEMISTRY') && !subjectName.includes('KITCHEN')) {
//                 classroom.subject = 'Science (Ch)'
//                 filteredClasses.push(classroom)
//               } else if (subjectName.includes('PHYSICS')) {
//                 classroom.subject = 'Science (Ph)'
//                 filteredClasses.push(classroom)
//               }
//             } else {
//               // Not a core subject so filtered out
//             }
//           } else {
//             // Accept all classrooms
//             filteredClasses.push(classroom)
//           }
//         }
//       })
//       if (student.classes.data.length > 0) {
//         // a student must have at least one class
//         student.classes.data = filteredClasses
//         filteredWondeStudents.push(student)
//       } else {
//         console.log(`student has no core classes - filtered out`, student)
//       }
//     } else {
//       console.log(`Student yearcode ${student.yearCode} - filtered out`, student)
//     }
//   })
//   console.log('filtered list[0]', filteredWondeStudents[0])
//   return filteredWondeStudents
// } // end doOptionsFilteringGeneric()
