import fs from 'fs';

const API_BASE_URL = 'https://skinsense-backend-240757536793.us-central1.run.app';
const IMAGE_PATH = 'C:/Users/User/.gemini/antigravity/brain/22c68977-3e59-40f7-9962-eea93462db8f/media__1789212024141.png'; // 1.png or similar valid image

async function run() {
    console.log("Creating assessment...");
    const createRes = await fetch(`${API_BASE_URL}/v1/assessments`, { method: "POST" });
    const createData = await createRes.json();
    const id = createData.id;
    console.log("Created:", id);

    console.log("Uploading image...");
    const formData = new FormData();
    const imageBlob = new Blob([fs.readFileSync(IMAGE_PATH)], { type: 'image/png' });
    formData.append("image", imageBlob, "image.png");

    const imageRes = await fetch(`${API_BASE_URL}/v1/assessments/${id}/image-assessment`, {
        method: "POST",
        body: formData,
    });
    const imageData = await imageRes.json();
    console.log("Image response status:", imageData.assessment_status);

    console.log("PREMATURE Fetching recommendation...");
    const badRecRes = await fetch(`${API_BASE_URL}/v1/assessments/${id}/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
    });
    const badRecData = await badRecRes.json();
    console.log("Premature Recommendation returned:", JSON.stringify(badRecData, null, 2).substring(0, 500));


    console.log("Submitting questionnaire...");
    const questionnaire = {
        "duration": "one_to_four_weeks",
        "itching": "yes",
        "pain_level": 2,
        "rapidly_spreading": "no",
        "affected_body_area": "face_or_neck",
        "fever": "no",
        "high_fever": "no",
        "swelling": "no",
        "difficulty_breathing": "no",
        "lip_tongue_throat_swelling": "no",
        "bleeding": "no",
        "blistering": "no",
        "open_wound": "no",
        "eye_involvement": "no",
        "possible_infection": "no",
        "previous_treatment": [],
        "known_allergies": [],
        "current_products": [],
        "age_group": "adult",
        "recurrent": "no"
    };

    const questRes = await fetch(`${API_BASE_URL}/v1/assessments/${id}/questionnaire`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questionnaire)
    });
    const questData = await questRes.json();
    console.log("Questionnaire status:", questData.status);

    console.log("Fetching recommendation...");
    const recRes = await fetch(`${API_BASE_URL}/v1/assessments/${id}/recommendation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
    });
    const recData = await recRes.json();
    console.log("Recommendation returned:", JSON.stringify(recData, null, 2).substring(0, 500));

    console.log("Calling getAssessment...");
    const getRes = await fetch(`${API_BASE_URL}/v1/assessments/${id}`);
    const getData = await getRes.json();
    console.log("Final assessment status:", getData.status);
    console.log("Has recommendation attached:", !!getData.recommendation);
}

run().catch(console.error);
