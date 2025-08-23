const db = require('./database.js');

const emailToFind = '3@3.com';

const checkUserData = async () => {
  try {
    console.log(`Buscando usuário com o e-mail: ${emailToFind}`);
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [emailToFind], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!user) {
      console.log(`Usuário com e-mail ${emailToFind} não encontrado.`);
      return;
    }

    console.log('Usuário encontrado:', { id: user.id, name: user.name, email: user.email });

    console.log(`Verificando planos de estudo para o usuário ID: ${user.id}`);
    const plans = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM study_plans WHERE user_id = ?', [user.id], (err, rows) => {
        if (err) reject(err);
        resolve(rows);
      });
    });

    if (plans && plans.length > 0) {
      console.log(`O usuário tem ${plans.length} plano(s) de estudo.`);
      console.log('Planos:', plans.map(p => ({ id: p.id, name: p.plan_name })));
    } else {
      console.log('O usuário NÃO tem planos de estudo cadastrados.');
    }

  } catch (error) {
    console.error('Erro ao verificar dados do usuário:', error);
  } finally {
    db.close();
  }
};

checkUserData();