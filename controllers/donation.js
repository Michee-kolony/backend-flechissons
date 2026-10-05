const Donation = require('../models/donation');

exports.sendDonation = (req, res) => {

    const donation = new Donation({
        ...req.body
    });

    donation.save()
            .then(() => res.status(201).json({ message: "Donation enregistrée avec succès" }))
            .catch(error => res.status(500).json(error));

};

exports.getDonations = (req, res) => {

    Donation.find()
            .sort({ date: -1 })
            .then(data => res.status(200).json(data))
            .catch(error => res.status(500).json(error));

};

exports.getoneDonation = (req, res) => {

    Donation.findOne({ _id: req.params.id })
            .then(data => res.status(200).json(data))
            .catch(error => res.status(500).json(error));

};

exports.deleteDonation = (req, res) => {

    Donation.deleteOne({ _id: req.params.id })
            .then(() => res.status(200).json({ message: "Donation supprimée avec succès" }))
            .catch(error => res.status(500).json(error));

};
