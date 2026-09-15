import fs from 'fs';
import path from 'path';

const API_URL = "https://skinsense-backend-240757536793.us-central1.run.app";
// Use dynamic fetch

async function runFlow() {
    console.log("Creating assessment...");
    const createResp = await fetch(`${API_URL}/v1/assessments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    const createData = await createResp.json();
    const id = createData.id;
    console.log(`Created ID: ${id}`);
    console.log(`Status: ${createData.status}`);

    console.log("Uploading image...");
    const formData = new FormData();
    // we can create a dummy 1x1 image blob
    const imgData = fs.readFileSync(path.join(process.cwd(), 'public', 'hero_nurse.png'));
    formData.append("image", new Blob([imgData], { type: "image/png" }), "test.png");

    const imgResp = await fetch(`${API_URL}/v1/assessments/${id}/image-assessment`, { method: "POST", body: formData });
    let imgDataRes = await imgResp.text();
    try { imgDataRes = JSON.parse(imgDataRes); } catch (e) { }
    console.log(`Image upload status: ${imgResp.status}`);
    console.log(`Image upload resp:`, imgDataRes);

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
    const qaRespData = await qaResp.text();
    console.log(`QA body:`, qaRespData);

    const getResp2 = await fetch(`${API_URL}/v1/assessments/${id}`);
    const getData2 = await getResp2.json();
    console.log(`Get response after QA: status=${getData2.status}`);

    console.log("Getting recommendation...");
    const recResp = await fetch(`${API_URL}/v1/assessments/${id}/recommendation`, { method: "POST" });
    const recData = await recResp.text();
    console.log(`Rec status: ${recResp.status} body: ${recData}`);
}

runFlow().catch(console.error);
