/**
 * This file is documentation only
 * It outlines the process of uploading a school as implemented in NewSchool
 * it also looks ahead to later incremental updates and periodic resyncing
 *
 * <NewSchool> is the component for school uptakes
 *
 * It has a useEffect() executed once to read the lookup tables to retrieve
 * the EdC/Elastik IDs for
 * Country, State, YearLevel and LearningArea
 *
 * It has a function getAllAchools() which is executed by UI Button
 * It retrieves the list of schools for the region from Wonde
 *
 * It has a function selectSchool that uses a useCallback() to remember which
 * school is curretly slected by the User
 *
 * It has a function getSchoolData() that is executed by UI Buttom
 * It retrieves all the data from Wonde for the selected school
 *
 * getSchoolData() calls
 *     getStudentsFromWonde() calls either
 *     readStudentsGroupsTeachers() if the school uses groups instead of classes
 *     Each student object has the data returned by
 *        ..../students?include=groups.employees,year
 *     readStudentsClassesTeachers() if teh school uses classes
 *     Each student object has the data returned by
 *        ..../students?include=classes.employees,classes.subject,year
 *
 *     In both cases  we extract the year code here using getYearCode()
 *        getYearCode() converts year to FY|R, K, 1,2,3,4,5,6,7,8,9,10,11,12,12
 *           or "U-no year" as default
 *     In both cases, a unique list of teachers is prepared and the teacher email address
 *     is added to each employee object.
 *
 *     formatStudentClassrooms() This processes [WondeStudents] into [studentClassrooms]
 *     which mimics the CSV file format of the old uploader.
 *        Dob is converetd to "DD/MM/YYYY" format or '01/01/1999' is inserted if no DoB
 *        Gender is converted to "Male" or "female"
 *        It fills in "subject" field if available
 *
 *  At this point the [studentClassrooms] object has the data in CSV formmat and is displayed
 *
 *  Filtering:
 *  The [studentClassrooms] object will contain classes that are not needed in EdC/Elastik
 *  The UI provides a popup screen to allow the user to define the filtering needed.
 *  There is a function called ApplyFilterOptions() activated by a UI Button of the same name.
 *
 *  Apply the filter options on the original raw data from Wonde (saved in [WondeStudents]).
 *  The filtering will do as below depending on UI options chosen"
 *  1. Remove classes eg those that are not core
 *  2. Amalgamate classes eg those like AM,PM etc in FY
 *  3. Remove years eg the school only want years 3-5 loaded
 *
 *  After filtering teh data is passed to formatStudentClassrooms() to make it scv format.
 *
 * Summary
 * getStudentsFromWonde() -> [wondeStudents] -> formatStudentClassrooms() -> [studentClassrooms]
 * getStudentsFromWonde() -> [wondeStudents]-> applyFilterOptions() -> formatStudentClassrooms() -> [filteredStudentClassrooms]
 *
 *  There is a function called save saveSchoolCSVtoDynamoDB() which is executed by a UI Button
 *  This does the following:
 *     saveSchool() saves the school record in tbale School
 *     makes a unique list of classrooms [uniqueClassroomsMap] from [filteredStudentClassrooms]
 *     makes a unique list of students [uniqueStudentsMap] from [filteredStudentClassrooms]
 *     makes a unique list of teachers [uniqueTeachersMap] from [filteredStudentClassrooms]
 *       This is slightly complicated because of the CSV format
 *
 *   Convert unique maps to arrays [uniqueClassroomsArray], [uniqueTeachersArray], [uniqueStudentsArray]
 *
 *   Save classrooms, teachers, students
 *   Note in all above we have to manually add fields:
 *      id, GSI fields as needed, typeName, createdAt and updatedAt
 *   to all records to emulate what Appsync would have done
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
