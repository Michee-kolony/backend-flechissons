const mongoose = require('mongoose');


// =====================================================
// CONVERSATION
// Échange privé entre UN utilisateur de l'app mobile
// et UN administrateur (admin ou superadmin / pasteur).
// Seuls ces deux comptes voient les messages.
// =====================================================

const conversationSchema = new mongoose.Schema(

  {

    utilisateur: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true,
      index: true
    },

    // Aperçu du dernier message (liste des conversations)
    dernierMessage: {
      texte: { type: String, default: '' },
      auteur: { type: String, enum: ['utilisateur', 'admin', null], default: null },
      date: { type: Date, default: null }
    },

    // Messages non lus par chacun des deux participants
    nonLusUtilisateur: { type: Number, default: 0 },
    nonLusAdmin: { type: Number, default: 0 }

  },

  {
    timestamps: true
  }

);

// Une seule conversation par couple utilisateur / administrateur
conversationSchema.index({ utilisateur: 1, admin: 1 }, { unique: true });
conversationSchema.index({ admin: 1, 'dernierMessage.date': -1 });
conversationSchema.index({ utilisateur: 1, 'dernierMessage.date': -1 });


module.exports =
  mongoose.models.Conversation ||
  mongoose.model('Conversation', conversationSchema);
