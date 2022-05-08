/**
 * This file is documentation only
 *
 * Summary of filtering and where it occurs
 * getStudentsFromWonde()
 *    student.yearCode is added
 *    classes.data.employees.data.email is added
 * doOptionsFilteringGeneric() - inserted before formatStudentClassrooms() for the filtered CSV
 *    removes unwanted years
 *    removes unwanted classrooms
 *    amalgamates Kindy classrooms if needed (like mon AM,Mon PM etc)
 * formatStudentClassrooms()
 *    student.email is composed as ${student.forename}${student.surname}@${selectedSchool.schoolName}
 *    classroom.subject is added if possible... ( not should only be done for primary years)
 *
 *
 * Below is outlined the process of uploading a school as implemented in NewSchool
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
 * It has a function selectSchool() that uses a useCallback() to remember which
 * school is curretly selected by the User
 *
 * It has a function getSchoolData() that is executed by UI Buttom
 * It retrieves all the data from Wonde for the selected school
 *
 * getSchoolData() calls
 *     getStudentsFromWonde() calls either
 *     readStudentsGroupsTeachers() if the school uses groups instead of classes
 *     Each student object has the data returned by
 *        ..../students?include=groups.employees,year
 *     readStudentsClassesTeachers() if the school uses classes
 *     Each student object has the data returned by
 *        ..../students?include=classes.employees,classes.subject,year
 *
 *     In both cases  we extract the year code here using getYearCode()
 *        getYearCode() converts year to FY|R, K, 1,2,3,4,5,6,7,8,9,10,11,12,12
 *           or "U-no year" as default
 *     In both cases, a unique list of teachers is prepared and
 *     the teacher email address is added to each employee object.
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
 *     saveSchool() saves the school record in table School
 *     makes an array classroomTeachersFromCSV[] from filteredStudentClassrooms[]
 *     makes a unique list of classrooms uniqueClassroomsMap[] from filteredStudentClassrooms[]
 *     makes a unique list of students uniqueStudentsMap[] from filteredStudentClassrooms[]
 *     makes a unique list of teachers uniqueTeachersMap[] from filteredStudentClassrooms[]
 *
 *   *****************************************************************************
 *    5/5/2022 - saveSchoolCSVtoDynamoDB() has been changed to allow addional year levels to be uploaded
 *   If years 3,5 were previously uploaded then its now OK to ask for year 4 in addition.
 *   If new option selection was 3,4 then we are not deleting year 5 as of now.
 *   So we want options 4 and 3,4 and 3,4,5 all to have the same effect - ie to add year 4
 *
 *   To this, we cull the unique lists above to remove classes, students and teachers that are
 *   already uploaded.
 *   This is nearly sufficent, but not quite. We have to reconstruct
 *      the classroomTeachersArray (see below)
 *      the classroomStudentsArray (see below)
 *   ********************************************************************************
 *
 *   Convert unique maps to arrays [uniqueClassroomsArray], [uniqueTeachersArray], [uniqueStudentsArray]
 *
 *   Save classrooms, teachers, students
 *   Note in all above we have to manually add fields:
 *      id, GSI fields as needed, typeName, createdAt and updatedAt
 *   to all records to emulate what Appsync would have done
 *
 *   For each classroom in uniqueClassroomsArray[]
 *       Save in table Classroom
 *            and add the classroomID key,value to uniqueClassroomsArray[]
 *   Make a classroomTeachersArray[]
 *       For every record in classroomTeachersFromCSV[]  elements {CwondID, email}
 *           Find the record in uniqueClassroomsArray[] with matching CwondID
 *           Make a new object {classroomID,email} using the classroomID from uniqueClassroomsArray[]
 *           Save it in classroomTeachersArray[]
 *  For each classroom in uniqueClassroomsArray[]
 *       Save one connection record in table classroomYearLevel
 *            here we seem to repeat the year code filtering done in ApplyOptions[]
 *  For each classroom in uniqueClassroomsArray[]
 *	     Save one connection in classroomLearningArea
 *
 *   For each teacher uniqueTeachersArray[]
 *       Save record to Cognito
 *   For each teacher uniqueTeachersArray[]
 *       Save in table User
 *	 For each record in classroomTeachersArray[]
         Save in table ClassroomTeacher 
 *
 *   For each student in uniqueStudenstArray[]
 *       save record to table Student
 *            and add the studentID key,value to each uniqueStudentsArray[] element
 *            (here we seem to repeat the year code filtering done in ApplyOptions())
 *            (here we change the DoB to '1999-01-01' is not a valid date)
 *    Make a classroomStudentArray[] - needs studentsIDs above
 *        For every record in filteredStudentClassrooms[]  elements {CwondID, ,,,,,}
 *        Find the record in uniqueClassroomsArray[] with matching CwondID
 *        if found
 *        Find the CwondID in uniqueStudentsArray[]
 *        if found
 *        Make a new object {classroomID,studentID}
 *             using the classroomID from uniqueClassroomsArray[] and
 *             using the studentID from uniqueStudentsArray[]
 *        Save it in classroomStudentsArray[]
 *   For each student in uniqueStudenstArray[]
 *       save record in table User
 *             same repitition of yearCode formatting
 *       add to schoolStudent
 *       add to classroomStudent
 *       add to Cognito
 */
