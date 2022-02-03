import React from 'react'
import { CCard, CContainer, CRow, CAlert } from '@coreui/react'
import { useDropzone } from 'react-dropzone'
import { useCallback } from 'react'
import { useState } from 'react'
import AWS from 'aws-sdk'
import SchoolListBox from './SchoolListBox'

const S3_BUCKET = 'YOUR_BUCKET_NAME_HERE'
const REGION = 'YOUR_DESIRED_REGION_HERE'

AWS.config.update({
  accessKeyId: 'YOUR_ACCESS_KEY_HERE',
  secretAccessKey: 'YOUR_SECRET_ACCESS_KEY_HERE',
})

const s3 = new AWS.S3({
  params: { Bucket: S3_BUCKET },
  region: REGION,
})

function Upload() {
  const [progress, setProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [failure, setFailure] = useState(false)
  const [data, setData] = useState('')
  const handleCallback = (childData) => {
    console.log(childData)
    setData(childData.Name)
  }

  const uploadFileToS3 = (file, body) => {
    const params = {
      ACL: 'public-read',
      Body: body,
      Bucket: S3_BUCKET,
      Key: file.name,
    }
    s3.putObject(params)
      .on('httpUploadProgress', (evt) => {
        setProgress(Math.round((evt.loaded / evt.total) * 100))
      })
      .send((err) => {
        if (err) {
          setFailure(true)
          console.log(err)
        } else {
          setSuccess(true)
        }
      })
  }

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onabort = () => console.log('file reading was aborted')
      reader.onerror = () => console.log('file reading has failed')
      reader.onload = () => {
        const binaryStr = reader.result
        console.log(binaryStr) // File Contents
        uploadFileToS3(file, binaryStr)
      }
      reader.readAsBinaryString(file)
    })
  }, [])
  const { getRootProps, getInputProps } = useDropzone({ onDrop })
  return (
    <CContainer>
      <CRow>
        <CCard className="upload-select-card">
          <SchoolListBox parentCallback={handleCallback}></SchoolListBox>
        </CCard>
      </CRow>
      <CRow>
        <CAlert color="primary" dismissible visible={success} onClose={() => setSuccess(false)}>
          Successfully uploaded files!
        </CAlert>
        <CAlert color="danger" dismissible visible={failure} onClose={() => setFailure(false)}>
          An error has occurred whilst uploading the files. Please try again.
        </CAlert>
        <CCard>
          <p className="school-selected">
            <b>School selected: {data}</b>
          </p>
          <div {...getRootProps({ className: 'dropzone' })}>
            <input {...getInputProps()} />
            <p>Drag and drop files here to upload, or click to select files</p>
          </div>
          <aside>
            <p>Progress {progress}%</p>
          </aside>
        </CCard>
      </CRow>
    </CContainer>
  )
}
export default Upload
