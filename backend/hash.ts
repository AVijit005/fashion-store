import * as argon2 from 'argon2';

async function generate() {
  const hash = await argon2.hash('admin123', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
  console.log(hash);
}

generate();
