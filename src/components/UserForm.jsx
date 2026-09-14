/**
 * UserForm.jsx
 * Add / Edit user form — extracted from AdminDashboard for maintainability.
 * Handles both staff account creation (via Firebase Auth) and student profile edits.
 */

export default function UserForm({ formData, setFormData, editId, onSubmit }) {
  const field = (key, value) => setFormData({ ...formData, [key]: value });
  const isStudent = formData.role === "student";
  const disabledCls = "bg-slate-50 cursor-not-allowed opacity-50";

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-6 rounded-2xl shadow-sm text-sm border border-slate-150 max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-3"
    >
      <h3 className="font-bold text-slate-800 text-base md:col-span-2">
        {editId
          ? "Update Profile"
          : isStudent
          ? "Add Student to Roster"
          : "Automated Account Creation"}
      </h3>

      {/* Role */}
      <div className="md:col-span-2">
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Role</label>
        <select
          value={formData.role}
          onChange={e => field("role", e.target.value)}
          className="w-full p-2.5 border rounded-lg bg-white font-bold"
          disabled={!!editId}
        >
          {editId && formData.role === "student" && (
            <option value="student">Student (registered via form)</option>
          )}
          <option value="instructor">Instructor</option>
          <option value="marketing">Marketing Staff</option>
          <option value="frontoffice">Front Office</option>
          <option value="officeboy">Office Boy</option>
        </select>
        {!editId && (
          <p className="text-[9px] text-gray-400 mt-1">
            Students now register via the Google Form — see the Student Applications tab.
          </p>
        )}
      </div>

      {/* Name */}
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={e => field("firstName", e.target.value)}
        className="w-full p-2.5 border rounded-lg"
        required
      />
      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={e => field("lastName", e.target.value)}
        className="w-full p-2.5 border rounded-lg"
        required
      />
      <input
        type="text"
        placeholder="Nickname"
        value={formData.nickname}
        onChange={e => field("nickname", e.target.value)}
        className="w-full p-2.5 border rounded-lg"
        required
      />

      {/* Gender */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Gender</label>
        <select
          value={formData.gender}
          onChange={e => field("gender", e.target.value)}
          className="w-full p-2.5 border rounded-lg bg-white font-bold"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      {/* Phone */}
      <input
        type="tel"
        placeholder="Phone Number"
        value={formData.phone}
        onChange={e => field("phone", e.target.value)}
        className="w-full p-2.5 border rounded-lg"
      />

      {/* Staff-only: email & password */}
      {!isStudent && (
        <>
          <input
            type="email"
            placeholder="Email"
            autoComplete="off"
            value={formData.email}
            onChange={e => field("email", e.target.value)}
            className="w-full p-2.5 border rounded-lg"
            required
            disabled={!!editId}
          />
          {!editId && (
            <input
              type="password"
              placeholder="Password"
              autoComplete="new-password"
              value={formData.password}
              onChange={e => field("password", e.target.value)}
              className="w-full p-2.5 border rounded-lg"
              required
            />
          )}
        </>
      )}

      {/* Date of Birth */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date of Birth</label>
        <input
          type="date"
          value={formData.dob}
          onChange={e => field("dob", e.target.value)}
          className="w-full p-2.5 border rounded-lg bg-white"
          required
        />
      </div>

      {/* Joined Date */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Joined Date</label>
        <input
          type="date"
          value={formData.joinedDate}
          onChange={e => field("joinedDate", e.target.value)}
          disabled={!isStudent}
          className={`w-full p-2.5 border rounded-lg transition ${!isStudent ? disabledCls : "bg-white"}`}
        />
      </div>

      {/* Education Level */}
      <div>
        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Education Level</label>
        <select
          value={formData.educationLevel}
          onChange={e => field("educationLevel", e.target.value)}
          className="w-full p-2.5 border rounded-lg bg-white font-bold"
        >
          <option value="SD">SD (Sekolah Dasar)</option>
          <option value="SMP">SMP (Sekolah Menengah Pertama)</option>
          <option value="SMA_SMK">SMA/SMK (Sekolah Menengah Atas/Kejuruan)</option>
          <option value="Universitas">Universitas / Perguruan Tinggi</option>
          <option value="Umum">Umum / Pekerja (Adult)</option>
        </select>
      </div>

      <hr className="border-slate-100 my-1 md:col-span-2" />
      <label className="block text-[10px] font-bold text-slate-400 uppercase md:col-span-2">
        Student Profile Fields
      </label>

      {/* Student-only fields */}
      <input
        type="text"
        placeholder="Parent's Name"
        value={formData.parentName}
        onChange={e => field("parentName", e.target.value)}
        disabled={!isStudent}
        className={`w-full p-2.5 border rounded-lg transition ${!isStudent ? disabledCls : "bg-white"}`}
      />
      <input
        type="tel"
        placeholder="Parent's Phone"
        value={formData.parentPhone}
        onChange={e => field("parentPhone", e.target.value)}
        disabled={!isStudent}
        className={`w-full p-2.5 border rounded-lg transition ${!isStudent ? disabledCls : "bg-white"}`}
      />
      <select
        value={formData.rating}
        onChange={e => field("rating", e.target.value)}
        disabled={!isStudent}
        className={`w-full p-2.5 border rounded-lg transition bg-white ${
          !isStudent ? `${disabledCls} text-slate-400` : "font-bold"
        }`}
      >
        <option value="1">1 Star (Beginner)</option>
        <option value="3">3 Star (Intermediate)</option>
        <option value="5">5 Star (Fluent)</option>
      </select>
      <textarea
        placeholder="Notes / Evaluation"
        value={formData.notes}
        onChange={e => field("notes", e.target.value)}
        disabled={!isStudent}
        className={`w-full p-2.5 border rounded-lg transition ${!isStudent ? disabledCls : "bg-white"}`}
      />

      <button
        type="submit"
        className="w-full bg-[#1a3a8f] text-white p-3 rounded-xl font-bold hover:bg-[#122b6e] transition md:col-span-2"
      >
        {editId ? "Update Profile" : "Create & Save Profile"}
      </button>
    </form>
  );
}
