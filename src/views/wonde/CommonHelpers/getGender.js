// Convert possible gender representations to "Male"|"Female"
export function getGender(genderName) {
  switch (genderName.toUpperCase()) {
    case 'MALE':
    case 'M':
    case 'BOY':
    case 'B':
      return 'Male'
    case 'FEMALE':
    case 'F':
    case 'GIRL':
    case 'G':
      return 'Female'
    default:
      return 'X'
  }
} // end getGender()
