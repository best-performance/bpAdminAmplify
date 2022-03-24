/**
 * This file is documentation only
 * It outlines the process of uploading a school as implemented in NewSchool
 *
 * The componeent is called <NewSchool>
 *
 * It has a useEffect() executed once to read the lookup tables to retrieve
 * the EdC/Elastik IDs for
 * Country, State, YearLevel and LearningArea
 *
 * It has a function getAllAchools() which is executed by UI Button
 * It retrieves the list of schools for teh region from Wonde
 *
 * It has a function selectSchool that uses a useCallback() to remember which
 * school is curretly slected by the User
 *
 * It has a function getSchoolData() that is executed by UI Buttom
 * It retrieves all the data from Wonde for the selected school
 *
 * getSchoolData() calls
 *     getStudentsFromWonde() This reads all students from Wonde and saves them
 *        in [WondeStudents] as raw data. Each student object has the data returned by
 *        ..../students?include=classes.employees,classes.subject,year
 *        If no gender then "X" is used
 *        If no DoB then "XX/XX/XXXX" is used
 *        If no year is used then "no year is entered"
 *     getTeachersFromWonde() This reads all teachers from Wonde and saves them
 *        in [WondeTeachers] as raw data. Each teacher object has the data returned by
 *        ..../employees/?has_class=true&include=contact_details,classes
 *        There is no filtering
 *     formatStudentClassrooms() This processes [WondeStudents] and [WondeTeachers] into
 *        [studentClassrooms] which mimics the CSV file format of the old uploader.
 *        Gender is converted to "Male" or "female"
 *        Dob is converetd to "DD/MM/YYYY" format
 *        Year is converted to FY|R, K, 1,2,3,4,5,6,7,8,9,10,11,12,12 or "U-no year" as default
 *
 *  At this point the [studentClassrooms] object is displayed in the leftmost tab
 *  Note there are 2 other redundant tabs that display students and teachers but not documented here
 *  because they will be removed later.
 *
 *  The [studentClassrooms] object will contain classes that are not needed in EdC/Elastik
 *  The UI provides a popup screen to allow the user to define the filtering needed.
 *
 *  There is a function called ApplyFilterOptions() acvated by a UI Button of the same name
 *  This in turn calls applyOptions() which does the filtering and returns the filtered list
 *  ApplyFilterOptions() then stores results in [filteredStudentClassrooms]
 *  [filteredStudentClassrooms] is displayed in the second tab of the display
 *  applyOptions() is [studentClassrooms] and does these things:
 *     converts numeric year codes like 1,2,3 to Y1,Y2,Y3 etc (better in formatStudentClassrooms()?)
 *     remove duplicate classes for primary schools based on Mon-AM etc
 *     Note: Check above code in ApplyOptions() with Diego
 *     remove all secondary classes that are not core subjects
 *
 *  There is a function called save saveSchoolCSVtoDynamoDB() which is executed by a UI Button
 *  This deos the following:
 *     saveSchool() saves the school record in tbale School
 *     makes a unique list of classrooms [uniqueClassroomsMap] from [filteredStudentClassrooms]
 *     makes a unique list of students [uniqueStudentsMap] from [filteredStudentClassrooms]
 *     makes a unique list of teachers [uniqueTeachersMap] from [filteredStudentClassrooms]
 *       This is slightly complicated because of the CSV format
 *
 *   Convert unique maps to arrays [uniqueClassroomsArray], [uniqueTeachersArray], [uniqueStudentsArray]
 *
 *   Save classrooms, teachers, students
 *   Note is all above we have to manually add id,GSI data,typeName,createdAt and updatedAt
 *
 *   For each classroom
 *       add to table classrooms
 *       Make a classroomTeacherArray[] - needs ids above
 *       add to table classroomYearLevel
 *            here we seem to repeat the year code filtering done in ApplyOptions()
 *	     add to table classroomLearningArea (not done yet)
 *
 *   For each teacher
 *       add to Cognito
 *       add to User classrooms
 *	     add to table classroomTeacher
 *
 *   For each Student
 *       add to student
 *            here we seem to repeat the year code filtering done in ApplyOptions()
 *            here we change the DoB to '1999-01-01' is not a valid date
 *       Make a classroomStudentArray[] - needs studentsIDs above
 *       add to User
 *             same repitition of yearCode formatting
 *       add to schoolStudent
 *       add to classroomStudent
 *       add to Cognito
 */
