const db = new Map();

const seedDb = ({ testUser01, testUser02 }) => {
  if (testUser01) {
    db.set(testUser01.id, {
      ...testUser01,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });

    db.set(testUser01.username, {
      ...testUser01,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });

    db.set(testUser01.email, {
      ...testUser01,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });

    db.set(testUser01.pk, {
      ...testUser01,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });
  }

  if (testUser02) {
    db.set(testUser02.id, {
      ...testUser02,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });

    db.set(testUser02.pk, {
      ...testUser02,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });

    db.set(testUser02.username, {
      ...testUser02,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });

    db.set(testUser02.email, {
      ...testUser02,
      friends: [],
      blockedUsers: [],
      blockedBy: [],
    });
  }
};

export default db;

export { seedDb };
