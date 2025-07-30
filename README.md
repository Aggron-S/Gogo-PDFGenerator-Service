# Gogo-PDFGenerator-Service 🔌
A custom web service built for automating PDF generation from data coming in external online platforms such as Kintone or Zoho Creator.

<br>

## 💡 Overview
This service automates the generation of PDF documents filled with data collected from platforms like **Kintone** or **Zoho Creator**, styled via **Canva**, and stored in **Dropbox**. A custom web service built in **Node.js (Express.js)** acts as the orchestration layer, enabling seamless communication between systems.

### Kintone -> Canva -> Dropbox 
![kintone-pdf-generation-automation](./assets/kintone-canva-dropbox-integration.png)

### Zoho Creator -> Canva -> Dropbox 
![zohocreator-pdf-generation-automation](./assets/zoho-canva-dropbox-integration.png)

<br>

## 🔀 Integration Flow
```txt
[External App (Kintone / Zoho Creator)]
        |
        V
[Custom Web Service (Node.js)]
        |
        |--> External APIs (Client-Defined)
        |--> Canva (PDF generation via Canva Connect API + Bulk Create)
        |--> Dropbox (file storage)
```
