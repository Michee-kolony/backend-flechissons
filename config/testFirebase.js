const { firebaseAuth } = require('./firebase');

async function testFirebase() {
  try {

    const listUsersResult = await firebaseAuth.listUsers(1);

    console.log('✅ Firebase fonctionne correctement');

    console.log(
      'Nombre d’utilisateurs récupérés :',
      listUsersResult.users.length
    );

  } catch (error) {

    console.error('❌ Erreur Firebase :', error);

  }
}

testFirebase();