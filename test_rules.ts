import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import * as fs from 'fs';

let testEnv: any;
const PROJECT_ID = "gen-lang-client-0749306660";

async function runTests() {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
  
  const aliceId = 'alice_leader_123';
  const aliceContext = testEnv.authenticatedContext(aliceId, { email: 'alice@test.com', email_verified: true });
  const famiId = 'fami_555';

  await testEnv.withSecurityRulesDisabled(async (context: any) => {
    const db = context.firestore();
    await db.doc(`users/${aliceId}`).set({
      uid: aliceId,
      email: 'alice@test.com',
      name: 'Alice',
      role: 'leader',
      createdAt: new Date().toISOString()
    });
    
    await db.doc(`famis/${famiId}`).set({
      name: 'Test Fami',
      leaderId: aliceId,
      createdAt: new Date().toISOString(),
      activeCall: {
        id: 'room_123',
        name: 'The Call',
        updatedAt: new Date().toISOString()
      }
    });
  });

  const db = aliceContext.firestore();
  try {
     const { deleteField } = require('firebase/firestore');
     await assertSucceeds(db.doc(`famis/${famiId}`).update({
         activeCall: deleteField()
     }));
     console.log("Delete call Succeeded!");
  } catch(e) {
     console.error("Delete call FAILED:", e);
  }
  
  process.exit(0);
}

runTests();
