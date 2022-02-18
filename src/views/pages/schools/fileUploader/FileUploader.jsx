import React, { useContext, useEffect } from 'react'
import { CCard, CContainer, CRow, CSpinner } from '@coreui/react'
import Storage from '@aws-amplify/storage'
import { useState } from 'react'
import loggedInContext from 'src/loggedInContext'
import Button from 'devextreme-react/button'
import notify from 'devextreme/ui/notify'

const FileUploader = () => {
  const [selectedFile, setSelectedFile] = useState()
  const [isSelected, setIsSelected] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)

  const { loggedIn } = useContext(loggedInContext)

  const changeHandler = (event) => {
    setSelectedFile(event.target.files[0])
    setIsSelected(true)
  }

  const uploadFileToS3 = async () => {
    setIsUploadingFile(true)
    if (selectedFile) {
      let extension = selectedFile.name.split('.').pop()
      if (['csv', 'xls', 'xlsx'].lastIndexOf(extension) > -1) {
        Storage.configure({
          bucket: 'bpadmin-sandbox-au',
          region: 'ap-southeast-2',
          identityPoolId: `${process.env.REACT_APP_IDENTITY_POOL}`,
        })

        let currentFolders = await Storage.list('')

        let schoolFolder = currentFolders.find((folder) => {
          if (folder.key) {
            return folder.key.replace('/', '') === loggedIn.schoolName
          }
          return false
        })

        if (!schoolFolder) {
          await Storage.put(`${loggedIn.schoolName}/`, null, {})
        }

        Storage.put(`${loggedIn.schoolName}/${selectedFile.name}`, selectedFile, {
          contentType: selectedFile.type,
        })
          .then((result) => {
            notify('👋 The file has been uploaded', 'success', 3000)
            setIsUploadingFile(false)
          })
          .catch((err) => {
            notify('The file has not been uploaded, please contact the support team', 'error', 3000)
            console.log('error', err)
            setIsUploadingFile(false)
          })
      } else {
        notify('Only spreadsheets with the format CSV, XLS, XLSX are accepted', 'error', 3000)
      }
    } else {
      notify('You have not selected any file to upload', 'error', 3000)
    }
    setIsUploadingFile(false)
    document.getElementById('fileInput').value = null
    setSelectedFile(null)
    setIsSelected(false)
  }

  return (
    <CContainer>
      <CRow>
        <CCard style={{ padding: '30px' }}>
          {/* <p className="school-selected"> */}
          <h4>School selected: {loggedIn.schoolName}</h4>
          {/* </p> */}
          <div>
            <input
              id="fileInput"
              type="file"
              name="file"
              onChange={changeHandler}
              accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            />
            {isSelected && selectedFile ? (
              <div style={{ padding: '15px' }}>
                <p>File name: {selectedFile.name}</p>
                <p>Size: {(selectedFile.size * 0.000001) / 1} MB</p>
                <p>Last Modified Date: {selectedFile.lastModifiedDate.toLocaleDateString()}</p>
              </div>
            ) : (
              <h5 style={{ marginTop: '30px' }}>Select a file to show details</h5>
            )}
            <div>
              <Button
                id="uploadFileBtn"
                text="Upload file"
                type="success"
                useSubmitBehavior={false}
                onClick={uploadFileToS3}
                style={{ marginTop: '30px' }}
              />
            </div>
          </div>
        </CCard>
      </CRow>
      {isUploadingFile && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            overflow: 'hidden',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
          }}
        >
          <CSpinner style={{ margin: 'auto' }}></CSpinner>
        </div>
      )}
    </CContainer>
  )
}
export default FileUploader
