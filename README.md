# Kintone/Zoho Creator Multiple API Integration  🔌
System design and integration flow for automating PDF generation from data coming in platforms such as Kintone or Zoho Creator, a custom Node.js web service, Canva, and Dropbox.

<br>

## 💡 Overview
This integration automates the generation of PDF documents filled with data collected from platforms like **Kintone** or **Zoho Creator**, styled via **Canva**, and stored in **Dropbox**. A custom web service built in **Node.js (Express.js)** acts as the orchestration layer, enabling seamless communication between systems.

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
