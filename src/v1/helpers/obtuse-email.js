const obtuseEmail = (email) => {
  if (typeof email !== "string") return null;

  const emailArr = email.split("@");

  const local = emailArr[0];
  const domain = emailArr[1];

  return `${local
    .split("")
    .map(() => "*")
    .join("")}${domain}`;
};

export default obtuseEmail;
