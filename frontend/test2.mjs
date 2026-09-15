import fs from 'fs';
import path from 'path';

const API_URL = "http://localhost:3001/backend-api";

async function runFlow() {
    console.log("Creating assessment...");
    const createResp = await fetch(`${API_URL}/v1/assessments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const createData = await createResp.json();
    const id = createData.id;
    console.log(`Created ID: ${id}`);

    console.log("Uploading image...");
    const formData = new FormData();
    const buf = fs.readFileSync('C:/Users/User/.gemini/antigravity/brain/22c68977-3e59-40f7-9962-eea93462db8f/media__1789212024141.png');
    formData.append("image", new Blob([buf], { type: "image/png" }), "image.png");

    const imgResp = await fetch(`${API_URL}/v1/assessments/${id}/image-assessment`, { method: "POST", body: formData });
    let imgDataRes = await imgResp.text();
    try { imgDataRes = JSON.parse(imgDataRes); } catch (e) { }
    console.log(`Image upload status: ${imgResp.status}`, imgDataRes);

    const getResp1 = await fetch(`${API_URL}/v1/assessments/${id}`);
    const getData1 = await getResp1.json();
    console.log(`Get response after image: status=${getData1.status}`);

    console.log("Submitting questionnaire...");
    const qaForm = {
        duration: "unsure",
        itching: "unsure",
        pain_level: 0,
        rapidly_spreading: "unsure",
        affected_body_area: "unsure",
        fever: "unsure",
        high_fever: "unsure",
        swelling: "unsure",
        difficulty_breathing: "unsure",
        lip_tongue_throat_swelling: "unsure",
        bleeding: "unsure",
        blistering: "unsure",
        open_wound: "unsure",
        eye_involvement: "unsure",
        possible_infection: "unsure",
        previous_treatment: [],
        known_allergies: [],
        current_products: [],
        age_group: "adult",
        recurrent: "unsure"
    };
    const qaResp = await fetch(`${API_URL}/v1/assessments/${id}/questionnaire`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(qaForm)
    });
    console.log(`QA status: ${qaResp.status}`);

    const getResp2 = await fetch(`${API_URL}/v1/assessments/${id}`);
    const getData2 = await getResp2.json();
    console.log(`Get response after QA: status=${getData2.status}`);
}

runFlow().catch(console.error);
