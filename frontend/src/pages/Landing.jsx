import { Link } from "react-router-dom";

export default function Landing() {
  return (
    <div className="landing">
      <h1>Welcome to Lipwa-Trust</h1>
      <div className="buttons">
        <Link to="/login"><button>Login</button></Link>
        <Link to="/register"><button>Register</button></Link>
      </div>
    </div>
  );
}