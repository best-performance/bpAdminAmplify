import React from 'react'
import { CContainer, CRow } from '@coreui/react'

function LandingPage() {
  return (
    <>
      <CContainer>
        <CRow>
          <img src="../assets/images/angular.jpg" className="img-fluid" alt=""></img>
          <h3 className="text-center">BPAdmin App</h3>
        </CRow>
        <CRow>
          <h6>This application is for exclusive use by authorised administrators for:</h6>
        </CRow>
        <CRow>
          <h6> - Uploading Wonde School data for new schools</h6>
        </CRow>
        <CRow>
          <h6> - Safely uploading school data into region specific locations for new schools</h6>
        </CRow>
        <CRow>
          <h6> - Uploading test results</h6>
        </CRow>
        <CRow>
          <h6> - Running standard administrative queries</h6>
        </CRow>
        <CRow>
          <h6 style={{ color: 'red' }}> - Please Login to access secure menu items</h6>
        </CRow>
      </CContainer>
    </>
  )
}
export default LandingPage
