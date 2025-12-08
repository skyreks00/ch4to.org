<?php
// --- CONFIGURATION BASE DE DONNÉES ---
$servername = "localhost";
$username_db = "root";
$password_db = "Tigrou007";
$dbname = "inscription_db";

$message = "";
$message_type = ""; 

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $username = trim($_POST['username']);
    $email = trim($_POST['email']);
    $password = $_POST['password'];
    $confirm_password = $_POST['confirm_password'];
    
    $firstname = trim($_POST['firstname']);
    $lastname = trim($_POST['lastname']);
    $birthdate = $_POST['birthdate'];
    $phone = trim($_POST['phone']);
    $address = trim($_POST['address']);
    $city = trim($_POST['city']);
    $zipcode = trim($_POST['zipcode']);
    $gender = $_POST['gender'] ?? '';
    $country = trim($_POST['country']);
    $job_title = trim($_POST['job_title']);
    $company = trim($_POST['company']);
    $website = trim($_POST['website']);
    $bio = trim($_POST['bio']);
    $newsletter = isset($_POST['newsletter']) ? 1 : 0;

    $errors = [];

    if (empty($username)) $errors[] = "Le nom d'utilisateur est requis.";
    if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = "Email invalide.";
    if (empty($password)) $errors[] = "Mot de passe requis.";
    elseif (strlen($password) < 6) $errors[] = "6 caractères minimum pour le mot de passe.";
    if ($password !== $confirm_password) $errors[] = "Les mots de passe ne correspondent pas.";

    if (empty($errors)) {
        try {
            $conn = @new mysqli($servername, $username_db, $password_db, $dbname);
            if ($conn->connect_error) {
                throw new Exception("Échec de la connexion à la base de données : " . $conn->connect_error);
            }

        } catch (Exception $e) {
            $message = "Erreur système : " . $e->getMessage();
            $message_type = "error";
            $conn = null;
        }

        if ($conn) {
            $check_stmt = $conn->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
            $check_stmt->bind_param("ss", $username, $email);
            $check_stmt->execute();
            $check_stmt->store_result();

            if ($check_stmt->num_rows > 0) {
                $message = "Compte déjà existant (pseudo ou email).";
                $message_type = "error";
            } else {
                $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                
                $sql = "INSERT INTO users (username, email, password, firstname, lastname, birthdate, phone, address, city, zipcode, gender, country, job_title, company, website, bio, newsletter) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                
                $stmt = $conn->prepare($sql);
                $stmt->bind_param("ssssssssssssssssi", $username, $email, $hashed_password, $firstname, $lastname, $birthdate, $phone, $address, $city, $zipcode, $gender, $country, $job_title, $company, $website, $bio, $newsletter);

                if ($stmt->execute()) {
                    $message = "Inscription complète réussie !";
                    $message_type = "success";              
                    $username = $email = $firstname = $lastname = $birthdate = $phone = $address = $city = $zipcode = $gender = $country = $job_title = $company = $website = $bio = "";
                    $_POST['password'] = $_POST['confirm_password'] = "";
                } else {
                    $message = "Erreur d'inscription : " . $stmt->error;
                    $message_type = "error";
                }
                $stmt->close();
            }
            $check_stmt->close();
            $conn->close();
        }
    } else {
        $message = implode("<br>", $errors);
        $message_type = "error";
    }
}
?>

<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inscription</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        /* Reset & Base */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Inter', sans-serif;
            background-color: #000;
            color: #fff;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background-image: radial-gradient(circle at 50% 0%, #2a2a2a 0%, #000 70%);
            padding: 20px;
        }
        
        .container {
            width: 100%;
            max-width: 500px;
            padding: 40px;
            background: #111;
            border: 1px solid #333;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.5);
        }

        h2 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
            text-align: center;
            letter-spacing: -0.5px;
        }
        
        .subtitle {
            text-align: center;
            color: #888;
            font-size: 14px;
            margin-bottom: 32px;
        }

        .form-group {
            margin-bottom: 20px;
        }
        
        .form-row {
            display: flex;
            gap: 15px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        label {
            display: block;
            font-size: 13px;
            font-weight: 500;
            color: #ccc;
            margin-bottom: 8px;
        }

        input, textarea {
            width: 100%;
            padding: 12px 16px;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 8px;
            color: #fff;
            font-size: 15px;
            transition: all 0.2s ease;
            font-family: inherit;
        }
        
        textarea {
            resize: vertical;
            min-height: 80px;
        }

        input:focus, textarea:focus {
            outline: none;
            border-color: #fff;
            background: #222;
            box-shadow: 0 0 0 4px rgba(255,255,255,0.1);
        }

        button {
            width: 100%;
            padding: 14px;
            background: #fff;
            color: #000;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.1s, opacity 0.2s;
            margin-top: 10px;
        }

        button:hover {
            opacity: 0.9;
        }
        
        button:active {
            transform: scale(0.98);
        }

        .message {
            padding: 12px;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 24px;
            text-align: center;
        }
        .error {
            background: rgba(255, 82, 82, 0.1);
            color: #ff5252;
            border: 1px solid rgba(255, 82, 82, 0.2);
        }
        .success {
            background: rgba(76, 175, 80, 0.1);
            color: #4caf50;
            border: 1px solid rgba(76, 175, 80, 0.2);
        }
    </style>
</head>
<body>
    <div class="container">
        <h2>Créer un compte</h2>
        <p class="subtitle">Rejoignez-nous dès aujourd'hui</p>

        <?php if (!empty($message)): ?>
            <div class="message <?php echo $message_type; ?>">
                <?php echo $message; ?>
            </div>
        <?php endif; ?>

        <form action="<?php echo htmlspecialchars($_SERVER["PHP_SELF"]); ?>" method="post">
            <div class="form-row">
                <div class="form-group">
                    <label>Prénom</label>
                    <input type="text" name="firstname" value="<?php echo isset($firstname) ? htmlspecialchars($firstname) : ''; ?>">
                </div>
                <div class="form-group">
                    <label>Nom</label>
                    <input type="text" name="lastname" value="<?php echo isset($lastname) ? htmlspecialchars($lastname) : ''; ?>">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Genre</label>
                    <select name="gender" style="width: 100%; padding: 12px 16px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; color: #fff; font-size: 15px; font-family: inherit;">
                        <option value="">Sélectionner...</option>
                        <option value="M" <?php if(isset($gender) && $gender == 'M') echo 'selected'; ?>>Homme</option>
                        <option value="F" <?php if(isset($gender) && $gender == 'F') echo 'selected'; ?>>Femme</option>
                        <option value="O" <?php if(isset($gender) && $gender == 'O') echo 'selected'; ?>>Autre</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Date de naissance</label>
                    <input type="date" name="birthdate" value="<?php echo isset($birthdate) ? htmlspecialchars($birthdate) : ''; ?>">
                </div>
            </div>

            <div class="form-group">
                <label>Email *</label>
                <input type="email" name="email" value="<?php echo isset($email) ? htmlspecialchars($email) : ''; ?>" required>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Téléphone</label>
                    <input type="tel" name="phone" value="<?php echo isset($phone) ? htmlspecialchars($phone) : ''; ?>">
                </div>
                <div class="form-group">
                    <label>Pays</label>
                    <input type="text" name="country" value="<?php echo isset($country) ? htmlspecialchars($country) : ''; ?>">
                </div>
            </div>

            <div class="form-group">
                <label>Adresse</label>
                <textarea name="address" rows="2"><?php echo isset($address) ? htmlspecialchars($address) : ''; ?></textarea>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Ville</label>
                    <input type="text" name="city" value="<?php echo isset($city) ? htmlspecialchars($city) : ''; ?>">
                </div>
                <div class="form-group">
                    <label>Code Postal</label>
                    <input type="text" name="zipcode" value="<?php echo isset($zipcode) ? htmlspecialchars($zipcode) : ''; ?>">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Poste actuel</label>
                    <input type="text" name="job_title" placeholder="Ex: Développeur Web" value="<?php echo isset($job_title) ? htmlspecialchars($job_title) : ''; ?>">
                </div>
                <div class="form-group">
                    <label>Entreprise</label>
                    <input type="text" name="company" value="<?php echo isset($company) ? htmlspecialchars($company) : ''; ?>">
                </div>
            </div>

            <div class="form-group">
                <label>Site Web / Portfolio</label>
                <input type="url" name="website" placeholder="https://..." value="<?php echo isset($website) ? htmlspecialchars($website) : ''; ?>">
            </div>

            <div class="form-group">
                <label>Bio</label>
                <textarea name="bio" rows="3" placeholder="Parlez-nous un peu de vous..."><?php echo isset($bio) ? htmlspecialchars($bio) : ''; ?></textarea>
            </div>

            <div class="form-group">
                <label>Nom d'utilisateur *</label>
                <input type="text" name="username" value="<?php echo isset($username) ? htmlspecialchars($username) : ''; ?>" required>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>Mot de passe *</label>
                    <input type="password" name="password" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Confirmation *</label>
                    <input type="password" name="confirm_password" required>
                </div>
            </div>

            <div class="form-group" style="display: flex; align-items: center; gap: 10px;">
                <input type="checkbox" name="newsletter" id="newsletter" style="width: auto;" <?php if(isset($newsletter) && $newsletter) echo 'checked'; ?>>
                <label for="newsletter" style="margin: 0; cursor: pointer;">M'inscrire à la newsletter</label>
            </div>

            <button type="submit">Créer mon profil complet &rarr;</button>
        </form>
    </div>
</body>
</html>